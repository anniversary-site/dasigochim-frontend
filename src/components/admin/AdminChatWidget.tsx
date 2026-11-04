import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import type { Building, Region, Report } from "@/types";
import BrandMark from "@/components/common/BrandMark";
import { reportCategory } from "@/utils/spaceCategorySummary";
import { answerComplaintQuestion, isQuestionLike, summarizeScope } from "@/utils/complaintChatAnswer";

export type ChatCategory = "공용공간" | "거주공간" | "주변공간";
export interface ChatScope {
  sido: string;
  district?: string;
  buildingId?: number;
  category?: ChatCategory;
}

type Picking = "sido" | "district" | "building" | "category" | null;
interface Option { label: string; kind: "ask" | "change" | "sido" | "district" | "building" | "category" | "done"; value?: string }
interface Message { id: number; role: "bot" | "user"; text: string; options?: Option[] }

const SUGGESTIONS = ["가장 많은 민원", "주요 불편 이유", "미처리 민원", "엑셀로 정리"];
const CATEGORIES: ChatCategory[] = ["공용공간", "거주공간", "주변공간"];
const norm = (s: string) => s.replace(/\s|·|\(|\)/g, "").toLowerCase();
const scopeKey = (s: ChatScope) => `${s.sido}|${s.district ?? ""}|${s.buildingId ?? ""}|${s.category ?? ""}`;

/**
 * 관리자 화면 오른쪽 아래 챗봇. 지금 보는 화면 범위로 시작하고,
 * 채팅에서 시·도 → 시·군·구 → 청년주택 → 공간 유형을 버튼이나 이름 입력으로 바꾼다.
 */
export default function AdminChatWidget({ regions, buildings, reports, pageScope }: {
  regions: Region[];
  buildings: Building[];
  reports: Report[];
  pageScope: ChatScope;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ChatScope>(pageScope);
  const [startedFrom, setStartedFrom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [picking, setPicking] = useState<Picking>(null);
  const [input, setInput] = useState("");
  const seq = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const countByBuilding = useMemo(() => {
    const m = new Map<number, number>();
    reports.forEach((r) => { if (r.building?.id) m.set(r.building.id, (m.get(r.building.id) ?? 0) + 1); });
    return m;
  }, [reports]);

  const label = (s: ChatScope) => {
    const b = s.buildingId ? byId.get(s.buildingId) : undefined;
    if (b) return s.category ? `${b.name} · ${s.category}` : b.name;
    return s.district ? `${s.sido} ${s.district}` : `${s.sido} 전체`;
  };
  const reportsIn = (s: ChatScope) => reports.filter((r) => {
    const b = r.building?.id ? byId.get(r.building.id) : undefined;
    if (!b || b.sido !== s.sido) return false;
    if (s.district && b.sigungu !== s.district) return false;
    if (s.buildingId && b.id !== s.buildingId) return false;
    if (s.category && reportCategory(r, []) !== s.category) return false;
    return true;
  });
  const count = (pred: (b: Building) => boolean) =>
    buildings.filter(pred).reduce((n, b) => n + (countByBuilding.get(b.id) ?? 0), 0);

  const sidoOrder = regions.map((r) => r.sido);
  const sidos = [...new Set(buildings.map((b) => b.sido).filter((v): v is string => !!v))]
    .sort((a, b) => sidoOrder.indexOf(a) - sidoOrder.indexOf(b));
  const districtsOf = (sido: string) => {
    const order = regions.find((r) => r.sido === sido)?.sigungus ?? [];
    return [...new Set(buildings.filter((b) => b.sido === sido).map((b) => b.sigungu).filter((v): v is string => !!v))]
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  };
  const buildingsOf = (sido: string, district: string) => buildings
    .filter((b) => b.sido === sido && b.sigungu === district)
    .sort((a, b) => (countByBuilding.get(b.id) ?? 0) - (countByBuilding.get(a.id) ?? 0));

  const bot = (text: string, options?: Option[]): Message => ({ id: ++seq.current, role: "bot", text, options });
  const user = (text: string): Message => ({ id: ++seq.current, role: "user", text });
  const scopeOptions: Option[] = [...SUGGESTIONS.map((q) => ({ label: q, kind: "ask" as const })), { label: "범위 바꾸기", kind: "change" }];

  // 열 때: 처음이거나 화면 범위가 바뀌었으면 화면 범위로 새로 시작한다.
  const openWidget = () => {
    const key = scopeKey(pageScope);
    if (startedFrom !== key || !messages.length) {
      setScope(pageScope);
      setPicking(null);
      setStartedFrom(key);
      setMessages([bot(`지금 보고 있는 '${label(pageScope)}' 범위로 시작할게요. ${summarizeScope(label(pageScope), reportsIn(pageScope))}\n무엇을 도와드릴까요? 다른 지역이나 청년주택은 '범위 바꾸기'를 누르거나 이름을 입력해 주세요.`, scopeOptions)]);
    }
    setOpen(true);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages, open]);

  const finish = (next: ChatScope, extra: Message[] = []) => {
    setScope(next);
    setPicking(null);
    return [...extra, bot(`'${label(next)}'(으)로 범위를 바꿨어요. ${summarizeScope(label(next), reportsIn(next))}`, scopeOptions)];
  };

  const askSido = () => {
    setPicking("sido");
    return bot("어느 시·도를 볼까요?", sidos.map((s) => ({ label: `${s} (${count((b) => b.sido === s)})`, kind: "sido", value: s })));
  };
  const askDistrict = (sido: string) => {
    setPicking("district");
    return bot(`${sido}의 시·군·구를 골라 주세요.`, [
      { label: `${sido} 전체`, kind: "done" },
      ...districtsOf(sido).map((d) => ({ label: `${d} (${count((b) => b.sido === sido && b.sigungu === d)})`, kind: "district" as const, value: d })),
    ]);
  };
  const askBuilding = (sido: string, district: string) => {
    setPicking("building");
    return bot(`${district}의 청년주택을 골라 주세요.`, [
      { label: `${district} 전체`, kind: "done" },
      ...buildingsOf(sido, district).map((b) => ({ label: `${b.name} (${countByBuilding.get(b.id) ?? 0})`, kind: "building" as const, value: String(b.id) })),
    ]);
  };
  const askCategory = (next: ChatScope) => {
    setPicking("category");
    const base = reportsIn({ ...next, category: undefined });
    return bot("공간 유형을 골라 주세요.", [
      { label: `전체 (${base.length})`, kind: "done" },
      ...CATEGORIES.map((c) => ({ label: `${c} (${base.filter((r) => reportCategory(r, []) === c).length})`, kind: "category" as const, value: c })),
    ]);
  };

  /** 버튼을 누르거나 입력이 선택지와 맞았을 때 */
  const choose = (option: Option, echo = option.label.replace(/\s\(\d+\)$/, "")) => {
    const out: Message[] = [user(echo)];
    switch (option.kind) {
      case "ask":
        out.push(bot(answerComplaintQuestion(label(scope), reportsIn(scope), option.label)));
        setPicking(null);
        break;
      case "change":
        out.push(askSido());
        break;
      case "sido": {
        const next = { sido: option.value! };
        setScope(next);
        out.push(askDistrict(next.sido));
        break;
      }
      case "district": {
        const next = { sido: scope.sido, district: option.value! };
        setScope(next);
        out.push(askBuilding(next.sido, next.district));
        break;
      }
      case "building": {
        const next = { ...scope, buildingId: Number(option.value), category: undefined };
        setScope(next);
        out.push(askCategory(next));
        break;
      }
      case "category":
        out.push(...finish({ ...scope, category: option.value as ChatCategory }));
        break;
      case "done":
        out.push(...finish({ ...scope, category: undefined }));
        break;
    }
    setMessages((prev) => [...prev, ...out]);
  };

  const currentOptions = messages.length ? messages[messages.length - 1].options ?? [] : [];

  /** 입력한 이름으로 시·도 / 시·군·구 / 청년주택을 찾는다 */
  const findByName = (text: string): Message[] | null => {
    const q = norm(text.replace(/(으)?로?\s*(바꿔|보여|변경).*$/, ""));
    if (q.length < 2) return null;
    const hits = buildings.filter((b) => norm(b.name).includes(q));
    if (hits.length === 1) {
      const b = hits[0];
      const next = { sido: b.sido!, district: b.sigungu ?? undefined, buildingId: b.id };
      setScope(next);
      return [askCategory(next)];
    }
    const district = buildings.find((b) => b.sigungu && norm(b.sigungu) === q)
      ?? buildings.find((b) => b.sigungu && norm(b.sigungu).startsWith(q));
    if (district) {
      const next = { sido: district.sido!, district: district.sigungu! };
      setScope(next);
      return [askBuilding(next.sido, next.district)];
    }
    const sido = sidos.find((s) => norm(s).startsWith(q) || q.startsWith(norm(s).slice(0, 2)) && q.length <= 5);
    if (sido) {
      setScope({ sido });
      return [askDistrict(sido)];
    }
    if (hits.length > 1) {
      setPicking("building");
      return [bot(`'${text}'(이)가 들어간 청년주택이 ${hits.length}곳이에요. 골라 주세요.`,
        hits.slice(0, 12).map((b) => ({ label: `${b.name} (${countByBuilding.get(b.id) ?? 0})`, kind: "building" as const, value: String(b.id) })))];
    }
    return null;
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setInput("");
    // 지금 고르는 단계의 선택지와 맞으면 그걸 고른다.
    if (picking) {
      const q = norm(text);
      const hit = currentOptions.find((o) => norm(o.label.replace(/\s\(\d+\)$/, "")) === q)
        ?? currentOptions.find((o) => o.kind !== "done" && norm(o.label).includes(q));
      if (hit) { choose(hit, text); return; }
      if (/^전체$/.test(text)) {
        const done = currentOptions.find((o) => o.kind === "done");
        if (done) { choose(done, text); return; }
      }
    }
    if (/범위/.test(text) && !isQuestionLike(text)) { setMessages((prev) => [...prev, user(text), askSido()]); return; }
    if (!isQuestionLike(text)) {
      const found = findByName(text);
      if (found) { setMessages((prev) => [...prev, user(text), ...found]); return; }
    }
    setPicking(null);
    setMessages((prev) => [...prev, user(text), bot(answerComplaintQuestion(label(scope), reportsIn(scope), text))]);
  };

  return <>
    {!open && <button type="button" className="admin-chat-fab" aria-label="민원 분석 AI 열기" onClick={openWidget}><MessageCircle size={26} /></button>}
    {open && <section className="admin-chat-window housing-chat" role="dialog" aria-label="민원 분석 AI">
      <div className="chat-heading"><div><b>민원 분석 AI</b><small className="chat-scope">범위: {label(scope)}</small></div>
        <button className="housing-icon-button" aria-label="챗봇 닫기" onClick={() => setOpen(false)}><X size={19} /></button></div>
      <div className="chat-messages" aria-live="polite">
        {messages.map((m, i) => m.role === "user"
          ? <div key={m.id} className="chat-user">{m.text}</div>
          : <div key={m.id} className="chat-bot-row">
            {i === 0 && <BrandMark />}
            <div className="chat-bot-body">
              <div className="chat-bubble answer">{m.text}</div>
              {m.options && i === messages.length - 1 && <div className="chat-suggestions">
                {m.options.map((o) => <button key={o.label} className={o.kind === "change" ? "is-change" : ""} onClick={() => choose(o)}>{o.label}</button>)}
              </div>}
            </div>
          </div>)}
        <div ref={bottomRef} />
      </div>
      <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <div><input aria-label="AI 질문 입력" placeholder={picking ? "이름을 입력하거나 위에서 골라 주세요" : "질문하거나 지역·청년주택 이름을 입력하세요"} value={input} onChange={(e) => setInput(e.target.value)} />
          <button disabled={!input.trim()} aria-label="보내기"><ArrowUp size={21} /></button></div>
        <small>현재는 등록된 민원을 집계한 기본 요약을 제공합니다. AI 연동 준비 중.</small>
      </form>
    </section>}
  </>;
}
