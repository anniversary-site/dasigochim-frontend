import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Camera, Image as ImageIcon, ArrowUp, MapPin, Pencil } from "lucide-react";
import { useAuth } from "@/auth";
import { aiApi, buildingApi, reportApi } from "@/api";
import type { ReportFlowAnswer, ReportQuestionStep } from "@/api";
import type { Building, BuildingSpace, BuildingUnit, Region, ScenePin, SpaceType } from "@/types";
import SceneViewer from "@/components/scene/SceneViewer";
import { IMPROVEMENT_MARKER } from "@/utils/reportDescription";

// 페이지 배경 (gray/10)
const BG = "#fcfcfc";
// 강조 (sogang/500)
const SOGANG_RED = "#a92614";

type Stage =
  | "photo"
  | "compose"
  | "region"
  | "housing"
  | "spaceKind"
  | "unitInput"
  | "commonSelect"
  | "scene"
  | "afterLocation"
  | "question"
  | "proposal";

type Msg =
  | {
      id: number;
      role: "ai";
      text: string;
      emphasis?: string | string[];
    }
  | { id: number; role: "user"; text: string }
  | { id: number; role: "photo" }
  | { id: number; role: "locationSaved"; label: string; sceneId: string; pin: ScenePin };

// AI 문장 내 특정 구절 강조 (여러 단어 지원)
function renderEmphasis(text: string, emp: string | string[]) {
  const words = Array.isArray(emp) ? emp : [emp];
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`);
  return text.split(re).map((part, i) =>
    words.includes(part) ? (
      <span key={i} className="font-semibold">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type MsgInput = DistributiveOmit<Msg, "id">;

export default function ReportFlowPage() {
  const navigate = useNavigate();
  const { isLoggedIn, isAuthLoading, user } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const proposalScrollRef = useRef<HTMLDivElement>(null);
  const bottomSpacerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState(120);
  const [headerHeight, setHeaderHeight] = useState(100);
  const idRef = useRef(1);
  const nextId = () => ++idRef.current;

  const [stage, setStage] = useState<Stage>("photo");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [memo, setMemo] = useState("");
  const [input, setInput] = useState("");
  const [reportId, setReportId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // 위치: 지역 → 청년주택 → 세대 내부(동·호수) 또는 공용공간 → 3D 장면에 핀
  const [regions, setRegions] = useState<Region[]>([]);
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [housings, setHousings] = useState<Building[]>([]);
  const [selectedHousing, setSelectedHousing] = useState<Building | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [spaceKind, setSpaceKind] = useState<SpaceType>("UNIT");
  const [dongInput, setDongInput] = useState("");
  const [hoInput, setHoInput] = useState("");
  const [unit, setUnit] = useState<BuildingUnit | null>(null);
  const [spaces, setSpaces] = useState<BuildingSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<BuildingSpace | null>(null);
  const [floorInput, setFloorInput] = useState("");
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [pin, setPin] = useState<ScenePin | null>(null);
  const [locationDetail, setLocationDetail] = useState("");
  // 신고서·관리자용 전체 위치 / AI 에 넘기는 위치(호수를 뺀다 — 초안 문장에 호수가 남지 않게)
  const [locationText, setLocationText] = useState("");
  const [aiLocationText, setAiLocationText] = useState("");

  // 맞춤 질문 — 한 번에 하나씩 받아오고, 답변은 다음 질문의 컨텍스트가 된다.
  const [step, setStep] = useState<ReportQuestionStep | null>(null);
  const [directActive, setDirectActive] = useState(false);
  const [directInput, setDirectInput] = useState("");
  const [answers, setAnswers] = useState<ReportFlowAnswer[]>([]);

  // 신고서 문서 (신고자는 로그인 정보 기반 실명 고정)
  const [draftSummary, setDraftSummary] = useState("");
  const [hazardContent, setHazardContent] = useState("");
  const [improvement, setImprovement] = useState("");
  const [editingSection, setEditingSection] = useState<
    null | "hazard" | "improvement"
  >(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      navigate("/login", { replace: true, state: { from: "/report" } });
    }
    if (!isAuthLoading && isLoggedIn && !user?.profileCompleted) {
      navigate("/profile", { replace: true, state: { from: "/report" } });
    }
  }, [isAuthLoading, isLoggedIn, navigate, user?.profileCompleted]);

  // 채팅과 신고서 화면이 같은 위치의 div라 React가 요소를 재사용해
  // 채팅에서 내려둔 스크롤 위치가 남는다. 진입 시 맨 위로 올린다.
  useEffect(() => {
    if (stage !== "proposal") return;
    proposalScrollRef.current?.scrollTo({ top: 0 });
  }, [stage]);

  useEffect(() => {
    if (stage !== "region") return;
    let cancelled = false;
    void (async () => {
      try {
        const items = await buildingApi.regions();
        if (cancelled) return;
        setRegions(items);
        // 선택지가 하나뿐이면 미리 골라 둔다.
        if (items.length === 1) {
          setSido(items[0].sido);
          if (items[0].sigungus.length === 1) setSigungu(items[0].sigungus[0]);
        }
        setApiError(null);
      } catch (error) {
        if (!cancelled) setApiError(error instanceof Error ? error.message : "지역 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  // objectURL 정리
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // 헤더/하단 dock 높이 측정 (오버레이 → 채팅 스크롤 여백 확보)
  useEffect(() => {
    const els: [HTMLElement | null, (h: number) => void][] = [
      [dockRef.current, setDockHeight],
      [headerRef.current, setHeaderHeight],
    ];
    const ros = els.map(([el, set]) => {
      if (!el) return null;
      const ro = new ResizeObserver(([e]) => set(e.contentRect.height));
      ro.observe(el);
      return ro;
    });
    return () => ros.forEach((ro) => ro?.disconnect());
  }, [stage]);

  // 스크롤: 내 답변을 인사 문구와 같은 높이로 올리고, 이어지는 AI 질문은
  // 그 아래에 나타나도록 스크롤을 건드리지 않는다.
  const prevCountRef = useRef(0);
  const anchorIdRef = useRef<number | null>(null);
  useEffect(() => {
    const start = messages.length < prevCountRef.current ? 0 : prevCountRef.current;
    prevCountRef.current = messages.length;
    const first = messages[start];
    // 내가 보낸 것(답변·사진)만 상단으로 올린다. AI 답변은 그 아래에 그대로 붙는다.
    if (first && (first.role === "user" || first.role === "photo")) {
      anchorIdRef.current = first.id;
    }
  }, [messages]);

  // 메시지 추가 직후에는 하단 독 높이가 아직 바뀌는 중이라, 레이아웃이 끝난 뒤 측정한다
  useEffect(() => {
    const id = anchorIdRef.current;
    if (id == null) return;
    const raf = requestAnimationFrame(() => {
      const cont = scrollRef.current;
      const spacer = bottomSpacerRef.current;
      if (!cont || !spacer) return;
      const el = cont.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
      if (!el) return;
      spacer.style.height = "0px";
      void cont.scrollHeight;
      // offsetTop은 스크롤 위치와 무관해 애니메이션 중에 다시 계산해도 값이 흔들리지 않는다.
      // 컨테이너 위쪽 패딩(headerHeight + 10)이 인사 문구의 시작 위치다.
      const target = el.offsetTop - (headerHeight + 10);
      // 내용이 화면보다 짧으면 스크롤 자체가 생기지 않는다.
      // 화면을 채우고도 target만큼 더 남도록 아래 여백을 만든다.
      const paddingBottom = parseFloat(getComputedStyle(cont).paddingBottom) || 0;
      const contentHeight = spacer.offsetTop + paddingBottom;
      const needed = target + cont.clientHeight - contentHeight;
      if (needed > 0) {
        spacer.style.height = `${needed}px`;
        // 여백을 만든 직후 스크롤하면 브라우저가 이전 높이 기준으로 잘라내므로 레이아웃을 반영시킨다
        void cont.scrollHeight;
      }
      cont.scrollTo({ top: target, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, headerHeight, dockHeight]);

  const addMsgs = (...msgs: MsgInput[]) =>
    setMessages((p) => [...p, ...msgs.map((m) => ({ ...m, id: nextId() }) as Msg)]);

  const handleClose = () => {
    if (reportId) void reportApi.deleteDraft(reportId).catch(() => undefined);
    navigate("/home");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
    setStage("compose");
  };

  const handleComposeSend = async () => {
    if (!memo.trim() || !photoFile || submitting) return;
    setSubmitting(true);
    setApiError(null);
    try {
      const draftReport = reportId
        ? { id: reportId }
        : await reportApi.createDraft();
      setReportId(draftReport.id);
      await reportApi.uploadPhotos(draftReport.id, [photoFile]);
      addMsgs(
        { role: "photo" },
        { role: "user", text: memo.trim() },
        { role: "ai", text: "보내주신 사진과 내용을 바탕으로 신고서를 작성할게요." },
        { role: "ai", text: "먼저 어느 지역의 청년주택인지 골라 주세요." },
      );
      setListLoading(true);
      setStage("region");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "사진을 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputSend = () => {
    const t = input.trim();
    if (!t) return;
    addMsgs({ role: "user", text: t });
    setInput("");
  };

  const handleRegionSelect = async () => {
    if (!sido || !sigungu || submitting) return;
    setSubmitting(true);
    setApiError(null);
    try {
      const items = await buildingApi.list(sido, sigungu);
      setHousings(items);
      setSelectedHousing(items.length === 1 ? items[0] : null);
      addMsgs(
        { role: "user", text: `${sido} ${sigungu}` },
        {
          role: "ai",
          text: items.length
            ? `${sigungu}의 청년주택 중 어디인가요?`
            : `${sigungu}에는 아직 등록된 청년주택이 없어요. 다른 지역을 골라 주세요.`,
        },
      );
      setStage(items.length ? "housing" : "region");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "청년주택 목록을 불러오지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHousingSelect = () => {
    if (!selectedHousing) return;
    // 내 거주지와 같은 단지면 동·호수를 미리 채워 둔다.
    if (user?.building?.id === selectedHousing.id) {
      setDongInput(user.dong ?? "");
      setHoInput(user.ho ?? "");
    }
    addMsgs(
      { role: "user", text: selectedHousing.name },
      { role: "ai", text: "신고할 곳이 세대 안인가요, 공용공간인가요?" },
    );
    setStage("spaceKind");
  };

  const handleSpaceKindSelect = async (kind: SpaceType) => {
    if (!selectedHousing || submitting) return;
    setSpaceKind(kind);
    setApiError(null);
    if (kind === "UNIT") {
      addMsgs(
        { role: "user", text: "세대 내부" },
        { role: "ai", text: "동·호수를 알려주세요. 해당 세대 타입의 3D 평면을 보여드릴게요." },
      );
      setStage("unitInput");
      return;
    }
    setSubmitting(true);
    try {
      const items = await buildingApi.spaces(selectedHousing.id);
      setSpaces(items);
      setSelectedSpace(null);
      addMsgs(
        { role: "user", text: "공용공간" },
        { role: "ai", text: "어느 공용공간인가요?" },
      );
      setStage("commonSelect");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "공용공간 목록을 불러오지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const openScene = (nextSceneId: string, userText: string) => {
    setSceneId(nextSceneId);
    setPin(null);
    setLocationDetail("");
    addMsgs(
      { role: "user", text: userText },
      { role: "ai", text: "3D 평면에서 문제가 있는 위치를 눌러 핀을 꽂아 주세요.\n끌어서 돌리고, 두 손가락이나 휠로 확대할 수 있어요." },
    );
    setStage("scene");
  };

  const handleUnitSubmit = async () => {
    if (!selectedHousing || !hoInput.trim() || submitting) return;
    setSubmitting(true);
    setApiError(null);
    try {
      const found = await buildingApi.lookupUnit(selectedHousing.id, hoInput.trim(), dongInput.trim() || undefined);
      setUnit(found);
      const dongText = found.dong ? `${found.dong}동 ` : "";
      openScene(found.sceneId, `${dongText}${found.ho}호 (${found.unitType} TYPE)`);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "세대를 찾지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSpaceSubmit = () => {
    if (!selectedSpace) return;
    if (selectedSpace.requiresFloor && !floorInput.trim()) return;
    const floorText = selectedSpace.requiresFloor ? ` ${floorInput.trim()}층` : "";
    openScene(selectedSpace.sceneId, `${selectedSpace.name}${floorText}`);
  };

  const startQuestions = (firstStep: ReportQuestionStep) => {
    setStep(firstStep);
    setAnswers([]);
    addMsgs(
      ...(firstStep.introduction
        ? ([
            {
              role: "ai",
              text: firstStep.introduction,
              emphasis: "질문 세 가지만",
            },
          ] as MsgInput[])
        : []),
      { role: "ai", text: firstStep.question.text },
    );
    setDirectActive(false);
    setDirectInput("");
    setStage("question");
  };

  const handleSceneConfirm = async () => {
    if (!reportId || !selectedHousing || !sceneId || !pin || submitting) return;
    setSubmitting(true);
    setApiError(null);
    // 공용공간 이름과 핀 근처 라벨이 같으면("피트니스 · 피트니스 부근") 라벨을 생략한다.
    const sameAsSpace = spaceKind === "COMMON" && pin.label != null && selectedSpace?.name.startsWith(pin.label);
    const near = pin.label && !sameAsSpace ? `${pin.label} 부근` : "";
    const detail = locationDetail.trim();
    const where = [near, detail].filter(Boolean).join(" · ");
    let fullText: string;
    let aiText: string;
    if (spaceKind === "UNIT" && unit) {
      const dongText = unit.dong ? `${unit.dong}동 ` : "";
      fullText = `${selectedHousing.name} ${dongText}${unit.ho}호 (${unit.unitType} TYPE)${where ? ` · ${where}` : ""}`;
      aiText = `${selectedHousing.name} 세대 내부 (${unit.unitType} TYPE)${where ? ` · ${where}` : ""}`;
    } else {
      const floorText = selectedSpace?.requiresFloor && floorInput.trim() ? ` ${floorInput.trim()}층` : "";
      fullText = `${selectedHousing.name} ${selectedSpace?.name ?? "공용공간"}${floorText}${where ? ` · ${where}` : ""}`;
      aiText = fullText;
    }
    try {
      await reportApi.patchLocation(reportId, {
        buildingId: selectedHousing.id,
        locationDescription: fullText,
        indoor: true,
        spaceType: spaceKind,
        spaceCode: spaceKind === "COMMON" ? selectedSpace?.code : undefined,
        dong: spaceKind === "UNIT" ? unit?.dong ?? (dongInput.trim() || undefined) : undefined,
        room: spaceKind === "UNIT" ? unit?.ho : undefined,
        floor: spaceKind === "COMMON" && selectedSpace?.requiresFloor ? floorInput.trim() : undefined,
        sceneId,
        pinX: pin.x,
        pinY: pin.y,
        pinZ: pin.z,
        pinLabel: pin.label ?? undefined,
      });
      setLocationText(fullText);
      setAiLocationText(aiText);
      const firstStep = await aiApi.getNextReportQuestion(reportId, memo.trim(), []);
      addMsgs({ role: "locationSaved", label: fullText, sceneId, pin });
      setStage("afterLocation");
      setTimeout(() => startQuestions(firstStep), 900);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "위치를 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswer = async (text: string) => {
    const t = text.trim();
    const current = step;
    if (!t || !current || !reportId || submitting) return;
    addMsgs({ role: "user", text: t });
    const nextAnswers = [
      ...answers,
      {
        questionId: current.question.id,
        question: current.question.text,
        answer: t,
        // AI 질문의 axis는 없을 수(null) 있으므로 답변 API에는 필드를 생략한다.
        axis: current.axis ?? undefined,
      },
    ];
    setAnswers(nextAnswers);
    setDirectActive(false);
    setDirectInput("");

    setSubmitting(true);
    setApiError(null);
    try {
      if (!current.last) {
        // 방금 받은 답변까지 넘겨 다음 질문을 만든다.
        const nextStep = await aiApi.getNextReportQuestion(
          reportId,
          memo.trim(),
          nextAnswers,
        );
        addMsgs({ role: "ai", text: nextStep.question.text });
        setStep(nextStep);
        return;
      }
      const generated = await aiApi.createReportDraft(
        reportId,
        aiLocationText || locationText,
        memo.trim(),
        nextAnswers,
      );
      addMsgs({
        role: "ai",
        text: "내용을 정리해 신고서를 작성했어요.",
      });
      setDraftSummary(generated.summary);
      setHazardContent(generated.hazardContent);
      setImprovement(generated.improvementSuggestion);
      setStage("proposal");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "신고서를 생성하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (section: "hazard" | "improvement") => {
    setEditingSection(section);
    setDraft(section === "hazard" ? hazardContent : improvement);
  };

  const commitEdit = () => {
    if (!editingSection) return;
    if (editingSection === "hazard") setHazardContent(draft);
    else setImprovement(draft);
    setEditingSection(null);
  };

  const handleSubmitProposal = async () => {
    if (!reportId || submitting) return;
    setSubmitting(true);
    setApiError(null);
    try {
      await reportApi.patch(reportId, {
        summary: draftSummary || `${aiLocationText || locationText} 민원 신고`,
        description: `${hazardContent}${IMPROVEMENT_MARKER}${improvement}`,
        reporterType: "REAL_NAME",
      });
      await reportApi.generateReportFile(reportId);
      await reportApi.submit(reportId);
      navigate("/home");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "신고를 전송하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };


  // ─── 신고서 문서 화면 (채팅 아님) ───
  if (stage === "proposal") {
    return (
      <div className="app-shell h-svh w-full flex flex-col" style={{ backgroundColor: BG }}>
        {/* 헤더 */}
        <div className="shrink-0 bg-gradient-to-b from-gray-10 to-transparent">
          <div style={{ height: "max(44px, env(safe-area-inset-top))" }} />
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <button
                onClick={handleClose}
                className="bg-white/30 backdrop-blur-[20px] rounded-full p-2.5 shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] transition active:bg-white/70 active:scale-95"
              >
                <X className="w-6 h-6 text-[#262626]" />
              </button>
              <div className="bg-white/30 backdrop-blur-[20px] rounded-full h-[44px] px-4 flex items-center shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)]">
                <span className="text-sm font-medium text-[#262626] tracking-[-0.28px] whitespace-nowrap">
                  신고서 전송
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 문서 본문 */}
        <div
          ref={proposalScrollRef}
          className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 py-[30px] flex flex-col gap-5"
        >
          {apiError && (
            <p className="rounded-[10px] bg-red-50 px-3 py-2 text-sm text-red-700">
              {apiError}
            </p>
          )}
          {/* 신고자 */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#9d9d9d] tracking-[-0.28px]">
              신고자
            </span>
            <span className="text-sm font-medium text-[#262626] tracking-[-0.28px] leading-[1.4]">
              {user?.name ?? "로그인 사용자"}
            </span>
          </div>

          {/* 위험장소 */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#9d9d9d] tracking-[-0.28px]">
              위험장소
            </span>
            <span className="text-sm font-medium text-[#262626] tracking-[-0.28px] leading-[1.4]">
              {locationText}
            </span>
          </div>

          {/* 안전·보건 유해/위험/시설/장소 내용 (수정 가능) */}
          <ProposalEditableField
            label="안전·보건 유해/위험/시설/장소 내용"
            value={hazardContent}
            editing={editingSection === "hazard"}
            draft={draft}
            onEdit={() => startEdit("hazard")}
          />

          {/* 개선 제안 사항 (수정 가능) */}
          <ProposalEditableField
            label="개선 제안 사항"
            value={improvement}
            editing={editingSection === "improvement"}
            draft={draft}
            onEdit={() => startEdit("improvement")}
          />

          {/* 사진 */}
          <div>
            <div className="aspect-square w-full rounded-[12px] overflow-hidden bg-[#e9e9e9]">
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt="첨부 사진"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>

        {/* 하단: 수정 중이면 편집 바, 아니면 전송 버튼 */}
        {editingSection ? (
          <div className="p-2.5 shrink-0">
            <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] flex items-end">
              <AutoTextarea
                autoFocus
                className="flex-1 min-w-0 p-5 bg-transparent outline-none resize-none text-sm text-[#262626] tracking-[-0.28px] leading-[1.4] max-h-[140px]"
                value={draft}
                onChange={setDraft}
                onEnter={commitEdit}
              />
              <div className="p-2.5 shrink-0">
                <button
                  onClick={commitEdit}
                  className="rounded-full p-2 flex items-center justify-center transition active:scale-95 active:brightness-90"
                  style={{ backgroundColor: SOGANG_RED }}
                >
                  <ArrowUp className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2.5 shrink-0">
            <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] p-5">
              <button
                onClick={handleSubmitProposal}
                disabled={submitting}
                className="w-full h-11 rounded-[10px] text-base font-semibold text-white tracking-[-0.4px] transition active:brightness-90"
                style={{ backgroundColor: SOGANG_RED }}
              >
                {submitting ? "전송 중..." : "신고서 전송하기"}
              </button>
            </div>
          </div>
        )}

        {/* HomeIndicator 영역 */}
        <div className="h-[34px] shrink-0" />
      </div>
    );
  }

  const progress =
    stage === "photo" || stage === "compose"
      ? "사진 · 설명 1/4"
      : stage === "region" ||
          stage === "housing" ||
          stage === "spaceKind" ||
          stage === "unitInput" ||
          stage === "commonSelect" ||
          stage === "scene" ||
          stage === "afterLocation"
        ? "신고 위치 2/4"
        : "맞춤 질문 3/4";

  return (
    <div
      className="app-shell h-svh w-full flex flex-col relative"
      style={{ backgroundColor: BG }}
    >
      {/* 헤더 (채팅 위 오버레이) */}
      <div ref={headerRef} className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-gray-10 to-transparent">
        <div style={{ height: "max(44px, env(safe-area-inset-top))" }} />
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="bg-white/30 backdrop-blur-[20px] rounded-full p-2.5 shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] transition active:bg-white/70 active:scale-95"
            >
              <X className="w-6 h-6 text-[#262626]" />
            </button>
            <div className="bg-white/30 backdrop-blur-[20px] rounded-full h-[44px] px-4 flex items-center shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)]">
              <span className="text-sm font-medium text-[#262626] tracking-[-0.28px] whitespace-nowrap">
                {progress}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 대화 영역 */}
      <div
        ref={scrollRef}
        className="relative flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 flex flex-col gap-5"
        style={{ paddingTop: headerHeight + 10, paddingBottom: dockHeight + 20 }}
      >
        {/* AI 인사 */}
        <p className="max-w-[300px] text-sm text-[#262626] tracking-[-0.28px] leading-[1.4]">
          안녕하세요! 위험한 곳/수리가 필요한 곳을 발견했나요?
          <br />
          <span className="font-bold">사진 한 장과 어떤 상황인지</span> 함께 알려주세요.
        </p>

        {apiError && (
          <p className="max-w-[300px] rounded-[10px] bg-red-50 px-3 py-2 text-sm text-red-700">
            {apiError}
          </p>
        )}

        {messages.map((m) => {
          if (m.role === "ai") {
            return (
              <p
                key={m.id}
                data-msg-id={m.id}
                className="max-w-[300px] text-sm text-[#262626] tracking-[-0.28px] leading-[1.4] whitespace-pre-line"
              >
                {m.emphasis ? renderEmphasis(m.text, m.emphasis) : m.text}
              </p>
            );
          }
          if (m.role === "user") {
            return (
              <div key={m.id} data-msg-id={m.id} className="flex justify-end">
                <div
                  className="max-w-[300px] rounded-[20px] px-4 py-3"
                  style={{ backgroundColor: SOGANG_RED }}
                >
                  <p className="text-sm text-[#fcfcfc] tracking-[-0.28px] leading-[1.4]">
                    {m.text}
                  </p>
                </div>
              </div>
            );
          }
          if (m.role === "locationSaved") {
            return (
              <div key={m.id} data-msg-id={m.id} className="flex flex-col gap-2.5 items-start">
                <p className="max-w-[300px] text-sm text-[#262626] tracking-[-0.28px] leading-[1.4]">
                  위치를 저장했어요.
                  <br />
                  <span className="font-semibold">{m.label}</span>
                </p>
                <SceneViewer sceneId={m.sceneId} mode="view" pin={m.pin} className="h-[200px] w-[300px] border border-[#e9e9e9]" />
              </div>
            );
          }
          // photo
          return (
            <div key={m.id} data-msg-id={m.id} className="flex justify-end">
              <div className="relative size-[180px] rounded-[12px] overflow-hidden bg-[#e9e9e9]">
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="첨부 사진"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* AI 호출이 몇 초 걸려 비어 보이지 않게, 다음 답변이 올 자리에 진행 상태를 남긴다 */}
        {submitting && step && (
          <div className="flex items-center gap-2">
            <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-[#e9e9e9] border-t-sogang-500" />
            <span className="text-sm text-[#9d9d9d] tracking-[-0.28px] leading-[1.4]">
              {step.last ? "신고서를 작성하고 있어요..." : "다음 질문을 준비하고 있어요..."}
            </span>
          </div>
        )}

        <div ref={bottomSpacerRef} className="shrink-0" />
      </div>

      {/* ─── 하단 독 (채팅 위 오버레이) ─── */}
      <div ref={dockRef} className="absolute bottom-0 left-0 right-0">
      {stage === "photo" && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] py-5">
            <div className="flex items-center gap-2.5 px-5">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2.5 border border-[#d9d9d9] rounded-[10px] px-5 py-4 transition active:bg-[#F5F5F5] active:border-[#262626] active:scale-[0.98]"
              >
                <Camera className="w-6 h-6 text-[#262626]" />
                <span className="text-sm font-medium text-[#262626] tracking-[-0.28px]">
                  촬영하기
                </span>
              </button>
              <button
                onClick={() => albumRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2.5 border border-[#d9d9d9] rounded-[10px] px-5 py-4 transition active:bg-[#F5F5F5] active:border-[#262626] active:scale-[0.98]"
              >
                <ImageIcon className="w-6 h-6 text-[#262626]" />
                <span className="text-sm font-medium text-[#262626] tracking-[-0.28px]">
                  앨범에서 선택
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "compose" && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)]">
            <div className="flex justify-center py-2.5">
              <div className="overflow-hidden rounded-[12px] bg-[#e9e9e9] h-[213px] aspect-[3/4]">
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="첨부 사진"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
            <div className="flex items-end">
              <AutoTextarea
                autoFocus
                className="flex-1 min-w-0 p-5 bg-transparent outline-none resize-none text-sm text-[#262626] tracking-[-0.28px] leading-[1.4] placeholder:text-[#C4C4C4] max-h-[140px]"
                placeholder="어떤 상황인지 알려주세요"
                value={memo}
                onChange={setMemo}
                onEnter={handleComposeSend}
              />
              <div className="p-2.5 shrink-0">
                <button
                  onClick={handleComposeSend}
                  disabled={submitting}
                  className="rounded-full p-2 flex items-center justify-center transition active:scale-95 active:brightness-90"
                  style={{ backgroundColor: SOGANG_RED }}
                >
                  <ArrowUp className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === "region" && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] p-5 flex flex-col gap-3">
            <p className="text-sm font-medium text-[#262626] tracking-[-0.28px]">지역을 선택해 주세요.</p>
            <div className="flex gap-2">
              <select
                aria-label="시·도"
                className="select-chevron w-full h-11 rounded-[10px] border border-[#E3E3E3] bg-white px-3 text-sm text-[#262626] outline-none"
                value={sido}
                disabled={listLoading}
                onChange={(e) => {
                  setSido(e.target.value);
                  const next = regions.find((region) => region.sido === e.target.value);
                  setSigungu(next?.sigungus.length === 1 ? next.sigungus[0] : "");
                }}
              >
                <option value="">{listLoading ? "불러오는 중..." : "시·도"}</option>
                {regions.map((region) => (
                  <option key={region.sido} value={region.sido}>
                    {region.sido}
                  </option>
                ))}
              </select>
              <select
                aria-label="시·군·구"
                className="select-chevron w-full h-11 rounded-[10px] border border-[#E3E3E3] bg-white px-3 text-sm text-[#262626] outline-none"
                value={sigungu}
                disabled={!sido}
                onChange={(e) => setSigungu(e.target.value)}
              >
                <option value="">시·군·구</option>
                {(regions.find((region) => region.sido === sido)?.sigungus ?? []).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => void handleRegionSelect()}
              disabled={!sido || !sigungu || submitting}
              className="w-full h-11 rounded-[10px] text-sm font-semibold text-white tracking-[-0.28px] transition disabled:bg-[#C4C4C4]"
              style={{ backgroundColor: SOGANG_RED }}
            >
              다음
            </button>
          </div>
        </div>
      )}

      {stage === "housing" && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] p-5 flex flex-col gap-3">
            <p className="text-sm font-medium text-[#262626] tracking-[-0.28px]">청년주택을 선택해 주세요.</p>
            <div className="flex flex-col gap-2">
              {housings.map((housing) => (
                <button
                  key={housing.id}
                  onClick={() => setSelectedHousing(housing)}
                  className={`w-full rounded-[10px] border bg-white px-4 py-3 text-left transition active:scale-[0.99] ${
                    selectedHousing?.id === housing.id ? "border-[#a92614]" : "border-[#E3E3E3]"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[#262626] tracking-[-0.28px]">{housing.name}</span>
                  {housing.address && (
                    <span className="block text-xs text-[#7b7b7b] tracking-[-0.24px]">{housing.address}</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={handleHousingSelect}
              disabled={!selectedHousing}
              className="w-full h-11 rounded-[10px] text-sm font-semibold text-white tracking-[-0.28px] transition disabled:bg-[#C4C4C4]"
              style={{ backgroundColor: SOGANG_RED }}
            >
              다음
            </button>
          </div>
        </div>
      )}

      {stage === "spaceKind" && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] p-5 flex flex-col gap-3">
            <p className="text-sm font-medium text-[#262626] tracking-[-0.28px]">신고할 곳을 골라 주세요.</p>
            <div className="flex gap-2.5">
              {([
                ["UNIT", "세대 내부", "우리 집 안 (욕실, 주방, 방 등)"],
                ["COMMON", "공용공간", "주차장, 피트니스, 세탁실, 복도 등"],
              ] as const).map(([kind, label, hint]) => (
                <button
                  key={kind}
                  onClick={() => void handleSpaceKindSelect(kind)}
                  disabled={submitting}
                  className="flex-1 rounded-[10px] border border-[#d9d9d9] bg-white px-4 py-4 text-left transition active:bg-[#F5F5F5] active:border-[#262626] active:scale-[0.98]"
                >
                  <span className="block text-sm font-semibold text-[#262626] tracking-[-0.28px]">{label}</span>
                  <span className="mt-1 block text-xs text-[#7b7b7b] tracking-[-0.24px] leading-[1.4]">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === "unitInput" && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] p-5 flex flex-col gap-3">
            <p className="text-sm font-medium text-[#262626] tracking-[-0.28px]">동·호수를 입력해 주세요.</p>
            <div className="flex gap-2">
              <div className="w-[38%]">
                <input
                  className="w-full h-11 rounded-[10px] border border-[#E3E3E3] bg-white px-3 text-sm text-[#262626] outline-none placeholder:text-[#C4C4C4]"
                  inputMode="numeric"
                  placeholder="동 (없으면 비움)"
                  value={dongInput}
                  onChange={(e) => setDongInput(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <input
                  autoFocus
                  className="w-full h-11 rounded-[10px] border border-[#E3E3E3] bg-white px-3 text-sm text-[#262626] outline-none placeholder:text-[#C4C4C4]"
                  inputMode="numeric"
                  placeholder="호수 (예: 1203)"
                  value={hoInput}
                  onChange={(e) => setHoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleUnitSubmit();
                  }}
                />
              </div>
            </div>
            <button
              onClick={() => void handleUnitSubmit()}
              disabled={!hoInput.trim() || submitting}
              className="w-full h-11 rounded-[10px] text-sm font-semibold text-white tracking-[-0.28px] transition disabled:bg-[#C4C4C4]"
              style={{ backgroundColor: SOGANG_RED }}
            >
              {submitting ? "세대를 찾는 중..." : "3D 평면 보기"}
            </button>
          </div>
        </div>
      )}

      {stage === "commonSelect" && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] p-5 flex flex-col gap-3">
            <p className="text-sm font-medium text-[#262626] tracking-[-0.28px]">공용공간을 선택해 주세요.</p>
            <div className="flex flex-wrap gap-2">
              {spaces.map((space) => (
                <button
                  key={space.code}
                  onClick={() => setSelectedSpace(space)}
                  className={`rounded-full border bg-white px-3.5 py-2 text-sm tracking-[-0.28px] transition active:scale-95 ${
                    selectedSpace?.code === space.code
                      ? "border-[#a92614] font-semibold text-[#a92614]"
                      : "border-[#E3E3E3] text-[#262626]"
                  }`}
                >
                  {space.name}
                </button>
              ))}
            </div>
            {selectedSpace?.requiresFloor && (
              <input
                className="w-full h-11 rounded-[10px] border border-[#E3E3E3] bg-white px-3 text-sm text-[#262626] outline-none placeholder:text-[#C4C4C4]"
                inputMode="numeric"
                placeholder="몇 층인가요? (예: 12)"
                value={floorInput}
                onChange={(e) => setFloorInput(e.target.value)}
              />
            )}
            <button
              onClick={handleSpaceSubmit}
              disabled={!selectedSpace || (selectedSpace.requiresFloor && !floorInput.trim())}
              className="w-full h-11 rounded-[10px] text-sm font-semibold text-white tracking-[-0.28px] transition disabled:bg-[#C4C4C4]"
              style={{ backgroundColor: SOGANG_RED }}
            >
              3D 평면 보기
            </button>
          </div>
        </div>
      )}

      {stage === "scene" && sceneId && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/80 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] p-3 flex flex-col gap-2.5">
            <SceneViewer sceneId={sceneId} mode="pick" pin={pin} onPin={setPin} className="h-[46svh] w-full border border-[#e9e9e9]" />
            <div className="flex items-center gap-2 px-1">
              <MapPin className="size-4 shrink-0 text-[#a92614]" />
              <span className="text-sm font-medium text-[#262626] tracking-[-0.28px]">
                {pin ? `${pin.label ?? "선택한 위치"} 부근에 핀을 꽂았어요` : "문제가 있는 위치를 눌러 주세요"}
              </span>
            </div>
            <input
              className="w-full h-11 rounded-[10px] border border-[#E3E3E3] bg-white px-3 text-sm text-[#262626] outline-none placeholder:text-[#C4C4C4]"
              placeholder="위치를 더 설명해 주세요 (선택, 예: 세면대 아래)"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
            />
            <button
              onClick={() => void handleSceneConfirm()}
              disabled={!pin || submitting}
              className="w-full h-11 rounded-[10px] text-sm font-semibold text-white tracking-[-0.28px] transition disabled:bg-[#C4C4C4]"
              style={{ backgroundColor: SOGANG_RED }}
            >
              {submitting ? "저장 중..." : "이 위치로 저장"}
            </button>
          </div>
        </div>
      )}

      {stage === "afterLocation" && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] flex items-end">
            <AutoTextarea
              className="flex-1 min-w-0 p-5 bg-transparent outline-none resize-none text-sm text-[#262626] tracking-[-0.28px] leading-[1.4] placeholder:text-[#7b7b7b] max-h-[140px]"
              placeholder="내용을 입력해주세요."
              value={input}
              onChange={setInput}
              onEnter={handleInputSend}
            />
            <div className="p-2.5 shrink-0">
              <button
                onClick={handleInputSend}
                className="bg-[#262626] rounded-full p-2 flex items-center justify-center transition active:scale-95 active:brightness-90"
              >
                <ArrowUp className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "question" && step && (
        <div className="p-2.5 shrink-0">
          <div className="w-full bg-white/30 backdrop-blur-[20px] rounded-[20px] shadow-[0px_2px_20px_0px_rgba(0,0,0,0.1)] pt-5 pb-2 flex flex-col">
            {/* 질문 */}
            <div className="px-5 pb-2">
              <p className="text-base font-medium text-[#262626] tracking-[-0.32px] leading-[1.4]">
                {step.question.text}
              </p>
            </div>
            {/* 선택지 */}
            {step.question.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => void handleAnswer(opt)}
                disabled={submitting}
                className="w-full flex items-center gap-4 px-5 py-3 border-b border-[#e9e9e9] transition active:bg-black/5"
              >
                <span className="size-[34px] shrink-0 flex items-center justify-center bg-[#eeeeee] rounded-full text-base font-medium text-black">
                  {i + 1}
                </span>
                <span className="flex-1 text-left text-sm text-[#262626] tracking-[-0.28px] leading-[1.4]">
                  {opt}
                </span>
              </button>
            ))}
            {/* 직접 입력 */}
            {step.question.allowCustom && (
            <div className="w-full flex items-center gap-4 px-5 py-3">
              <span className="size-[34px] shrink-0 flex items-center justify-center bg-[#eeeeee] rounded-full">
                <Pencil className="w-4 h-4 text-[#262626]" />
              </span>
              {directActive ? (
                <>
                  <input
                    autoFocus
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[#262626] tracking-[-0.28px] placeholder:text-[#c4c4c4]"
                    placeholder="답변을 입력하세요..."
                    value={directInput}
                    onChange={(e) => setDirectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAnswer(directInput);
                    }}
                  />
                  <button
                    onClick={() => void handleAnswer(directInput)}
                    disabled={submitting}
                    className="rounded-full p-2 shrink-0 flex items-center justify-center transition active:scale-95 active:brightness-90"
                    style={{ backgroundColor: SOGANG_RED }}
                  >
                    <ArrowUp className="w-6 h-6 text-white" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDirectActive(true)}
                  className="flex-1 text-left text-sm text-[#c4c4c4] tracking-[-0.28px] leading-[1.4]"
                >
                  직접 입력
                </button>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {/* HomeIndicator 영역 (컴포넌트 미표시, 영역만 유지) */}
      <div className="h-[34px] shrink-0" />
      </div>

      {/* 숨김 파일 입력 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ─── 자동 확장 입력창 (내용 많아지면 여러 줄) ───
function AutoTextarea({
  value,
  onChange,
  onEnter,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      autoFocus={autoFocus}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing && !e.shiftKey) {
          e.preventDefault();
          onEnter?.();
        }
      }}
      className={className}
    />
  );
}

// ─── 신고서 본문 (수정 가능 필드) ───
function ProposalEditableField({
  label,
  value,
  editing,
  draft,
  onEdit,
}: {
  label: string;
  value: string;
  editing: boolean;
  draft: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#9d9d9d] tracking-[-0.28px]">
          {label}
        </span>
        {editing ? (
          <span
            className="text-sm font-medium tracking-[-0.28px]"
            style={{ color: SOGANG_RED }}
          >
            수정중
          </span>
        ) : (
          <button
            onClick={onEdit}
            className="text-sm font-medium text-[#7b7b7b] tracking-[-0.28px] underline transition active:opacity-60"
          >
            수정
          </button>
        )}
      </div>
      {editing ? (
        <div
          className="rounded-[10px] border p-2"
          style={{ borderColor: SOGANG_RED }}
        >
          <p className="text-sm text-[#262626] tracking-[-0.28px] leading-[1.4] whitespace-pre-wrap">
            {draft}
          </p>
        </div>
      ) : (
        <p className="text-sm font-medium text-[#262626] tracking-[-0.28px] leading-[1.4] whitespace-pre-wrap">
          {value}
        </p>
      )}
    </div>
  );
}
