import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUp, X } from "lucide-react";
import { adminApi } from "@/api/admin";
import { buildingApi } from "@/api/buildings";
import { useAuth } from "@/auth";
import type { Building, BuildingSpace, Region, Report } from "@/types";
import { REPORT_STATUS_LABEL } from "@/types";
import BrandMark from "@/components/common/BrandMark";
import SpaceAnalysisSections, { type SpaceAnalysisData } from "@/components/admin/SpaceAnalysisSections";
import { reportCategory, spaceCategorySummary, type SpaceCategory } from "@/utils/spaceCategorySummary";

type Selection = { sido: string; district: string; dong: string; building: string };
const initial: Selection = { sido: "서울특별시", district: "", dong: "", building: "" };
const positions = [[44, 39], [25, 22], [18, 54], [59, 61]];
const dongOf = (b: Building) => b.address?.match(/\S+(?:동|읍|면)(?:\s|$)/)?.[0].trim() ?? "미등록";
const spaceLabel = (s: BuildingSpace) => `${s.floorLabel ?? ""} ${s.name}`.trim();
const belongsTo = (r: Report, s: BuildingSpace) => r.space?.code === s.code || (!r.space?.code && r.space?.name === s.name);
function groupProblems(reports: Report[]) {
  const groups = new Map<string, number>();
  reports.forEach(r => { const title = r.summary ?? "내용 미분류"; groups.set(title, (groups.get(title) ?? 0) + 1); });
  return [...groups].sort((a, b) => b[1] - a[1]);
}

export default function HousingAnalysisPage({ spaceAnalyses = {} }: { spaceAnalyses?: Readonly<Record<string, SpaceAnalysisData>> }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [selection, setSelection] = useState<Selection>(initial);
  const [applied, setApplied] = useState<Selection>(initial);
  const [regions, setRegions] = useState<Region[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [spaces, setSpaces] = useState<BuildingSpace[]>([]);
  const [category, setCategory] = useState("공용공간");
  const [categoryEntered, setCategoryEntered] = useState(false);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState("");
  const [floor, setFloor] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [panel, setPanel] = useState(false);
  const [chat, setChat] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ question: string; answer: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [account, setAccount] = useState(false);
  const [reviewIds, setReviewIds] = useState<number[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [rs, bs, first] = await Promise.all([buildingApi.regions(), buildingApi.list(), adminApi.reports({ size: 100 })]);
        const all = [...first.content];
        for (let page = 1; page < first.totalPages && active; page++) {
          const next = await adminApi.reports({ size: 100, page });
          all.push(...next.content);
        }
        if (active) { setRegions(rs); setBuildings(bs); setReports(all); setError(""); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "민원 현황을 불러오지 못했어요."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    if (!applied.building) return;
    let active = true;
    buildingApi.spaces(Number(applied.building)).then(data => { if (active) { setSpaces(data); setSpacesError(""); } })
      .catch(e => { if (active) setSpacesError(e instanceof Error ? e.message : "공간을 불러오지 못했어요."); })
      .finally(() => { if (active) setSpacesLoading(false); });
    return () => { active = false; };
  }, [applied.building, retry]);

  const currentSpaces = spaces;
  const building = buildings.find(b => String(b.id) === applied.building);
  const availableBuildings = buildings.filter(b => (!selection.sido || b.sido === selection.sido) && (!selection.district || b.sigungu === selection.district));
  const dongs = [...new Set(availableBuildings.map(dongOf))];
  const housingOptions = availableBuildings.filter(b => !selection.dong || dongOf(b) === selection.dong);
  const buildingReports = reports.filter(r => r.building?.id === building?.id);
  const categoryReports = buildingReports.filter(r => reportCategory(r, currentSpaces) === category);
  const selectedSpace = currentSpaces.find(s => s.code === selectedCode);
  const scopedReports = selectedSpace ? buildingReports.filter(r => belongsTo(r, selectedSpace)) : buildingReports;
  // Analysis is scoped by both building and space to prevent cross-building results.
  const spaceAnalysis = building && selectedSpace ? spaceAnalyses[`${building.id}:${selectedSpace.code}`] : undefined;
  const reviewReports = scopedReports.filter(r => reviewIds.includes(r.id));
  const categorySpaces = category === "공용공간" ? currentSpaces : [];
  const floorSpaces = categorySpaces.filter(s => (s.floorLabel ?? "기타") === floor);
  const problems = groupProblems(scopedReports);
  const countBuilding = (id: number) => reports.filter(r => r.building?.id === id).length;
  const countDistrict = (district: string) => reports.filter(r => buildings.some(b => b.id === r.building?.id && b.sido === applied.sido && b.sigungu === district)).length;
  const scopedBuildings = buildings.filter(b => b.sido === applied.sido && (!applied.district || b.sigungu === applied.district) && (!applied.dong || dongOf(b) === applied.dong));
  const districtNames = regions.find(r => r.sido === applied.sido)?.sigungus ?? [];
  const resetWorkspace = () => { setFloor(""); setSelectedCode(""); setPanel(false); setChat(false); setMessages([]); };
  const apply = (value: Selection) => {
    if (value.building !== applied.building) { setSpaces([]); setSpacesError(""); setSpacesLoading(Boolean(value.building)); }
    setSelection(value); setApplied(value); setCategory("공용공간"); setCategoryEntered(false); resetWorkspace();
  };
  const enterCategory = (value: string) => {
    setCategory(value); setCategoryEntered(true); resetWorkspace();
    if (value === "공용공간" && currentSpaces.length) {
      setFloor(currentSpaces[0].floorLabel ?? "기타"); setSelectedCode(currentSpaces[0].code);
    }
  };
  const pickFloor = (value: string) => {
    setFloor(value); setSelectedCode(categorySpaces.find(s => (s.floorLabel ?? "기타") === value)?.code ?? "");
    setPanel(false); setChat(false); setMessages([]);
  };
  const setField = (key: keyof Selection, value: string) => {
    setSelection(prev => key === "sido" ? { sido: value, district: "", dong: "", building: "" } : key === "district" ? { ...prev, district: value, dong: "", building: "" } : key === "dong" ? { ...prev, dong: value, building: "" } : { ...prev, building: value });
  };
  const total = scopedBuildings.reduce((n, b) => n + countBuilding(b.id), 0);
  const exportCsv = () => {
    const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    const csv = "\uFEFF" + [["번호", "민원", "공간", "상태"], ...scopedReports.map(r => [String(r.id), r.summary ?? "", r.locationDescription ?? "", REPORT_STATUS_LABEL[r.status]])].map(row => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "공간별-민원.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const ask = (text: string) => {
    if (!text.trim()) return;
    if (text.includes("엑셀")) exportCsv();
    const answer = text.includes("엑셀") ? "선택한 공간의 민원 목록을 CSV 파일로 내려받았어요. 엑셀에서 열 수 있어요."
      : scopedReports.length ? `현재 선택한 공간에는 민원 ${scopedReports.length}건이 있어요. ${problems.slice(0, 3).map(([label, count]) => `${label} ${count}건`).join(", ")}. 처리완료는 ${scopedReports.filter(r => r.status === "RESOLVED").length}건이에요. 이 답변은 등록된 제목과 상태를 집계한 기본 요약입니다. AI 분석 연동은 아직 준비 중이에요.`
      : "선택한 공간에 등록된 민원이 없어요. 다른 공간을 선택해 주세요.";
    setMessages(prev => [...prev, { question: text, answer }]); setQuestion("");
  };

  return <div className="housing-app">
    <header className="housing-header">
      <button className="housing-brand" onClick={() => apply(initial)}><BrandMark /><span>청년안심주택 민원분석</span></button>
      <nav aria-label="사용자 메뉴">
        <Link to="/admin/reports">신고 관리</Link>
        <button onClick={() => setAccount(true)}>마이페이지</button><i />
        <button onClick={() => { logout(); navigate("/login"); }}>로그아웃</button>
      </nav>
    </header>
    <form className="housing-filters" onSubmit={e => { e.preventDefault(); apply(selection); }}>
      <div className="housing-filter-row">
        {([
          ["sido", "시·도", [...new Set(["서울특별시", ...regions.map(r => r.sido)])].map(v => [v, v]), false],
          ["district", "자치구", (regions.find(r => r.sido === selection.sido)?.sigungus ?? []).map(v => [v, v]), false],
          ["dong", "동", dongs.map(v => [v, v]), !selection.district],
          ["building", "청년안심주택", housingOptions.map(b => [String(b.id), b.name]), !selection.district],
        ] as [keyof Selection, string, string[][], boolean][]).map(([key, label, options, disabled], index) => <Fragment key={key}>
          {index > 0 && <span className="filter-arrow" aria-hidden="true">→</span>}
          <label className={`housing-select ${disabled ? "is-disabled" : ""}`}><span>{label}</span>
            <select value={selection[key]} disabled={disabled || loading} onChange={e => setField(key, e.target.value)}>
              {key !== "sido" && <option value="">전체</option>}
              {options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
            </select>
          </label>
        </Fragment>)}
        <button className="housing-primary query-button" disabled={loading}>조회하기</button>
      </div>
      {building && <div className="housing-space-filters"><span>공간 유형</span>
        {["공용공간", "거주공간", "주변공간"].map(c => <button type="button" className={`housing-chip ${category === c ? "active" : ""}`} key={c} onClick={() => enterCategory(c)}>{c}</button>)}
        <i /><span>상세 공간</span>
        {[...new Set(categorySpaces.map(s => s.floorLabel ?? "기타"))].map(f => <button type="button" key={f} className={`housing-chip ${floor === f ? "active" : ""}`} onClick={() => pickFloor(f)}>{f} {categorySpaces.find(s => (s.floorLabel ?? "기타") === f)?.name}</button>)}
        {spacesLoading && <small role="status">공간 불러오는 중…</small>}
      </div>}
    </form>
    {error && <div className="housing-error" role="alert">{error} <button onClick={() => { setError(""); setLoading(true); setRetry(n => n + 1); }}>다시 불러오기</button></div>}
    {loading ? <main className="housing-content"><p className="housing-empty" role="status">민원 현황을 불러오고 있어요…</p></main>
    : !building ? <main className="housing-content">
      <div className="housing-heading"><div><p>{applied.district ? `${applied.sido} ${applied.district}` : `${applied.sido.replace("특별시", "시")} 전체`}</p><h1>{applied.district ? "청년안심주택별 민원 현황" : "자치구별 민원 현황"}</h1></div></div>
      <section className="housing-map" aria-label={applied.district ? "주택 선택" : "자치구 선택"}>
        <span className="map-placeholder">{applied.district || applied.sido.replace("특별시", "시")} 지도</span>
        {!error && (applied.district ? scopedBuildings.map((b, i) => <button key={b.id} className={`housing-marker ${i === 0 ? "active" : ""}`} style={{ left: `${positions[i % positions.length][0]}%`, top: `${positions[i % positions.length][1] + Math.floor(i / positions.length) * 9}%` }} onClick={() => apply({ ...applied, dong: dongOf(b), building: String(b.id) })}><b>{countBuilding(b.id)}</b><span>{b.name}</span></button>)
        : (districtNames.map((name, i) => [name, countDistrict(name), 10 + (i % 5) * 18, 14 + Math.floor(i / 5) * 16] as const)).map(([name, count, x, y], i) => <button key={name} className={`housing-marker ${i === 0 ? "active" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => apply({ ...applied, district: name, dong: "", building: "" })}><b>{count}</b><span>{name}</span></button>))}
        {!error && applied.district && !scopedBuildings.length && <p className="map-empty">등록된 청년안심주택이 없어요.</p>}
      </section>
      <footer className="housing-map-footer"><span>{applied.district ? "주택 마커를 선택해 건물을 확인하세요." : "자치구 마커를 선택해 상세 현황을 확인하세요."}</span><b>총 {total}건</b></footer>
    </main> : !floor && categoryEntered ? <main className="housing-content">
      <div className="housing-heading"><div><p>{building.name}</p><h1>{category} 민원 현황</h1><div className="housing-subtitle">{category === "공용공간" ? "상세 공간을 선택해 민원 현황을 확인하세요." : "이 유형으로 접수된 민원을 확인하세요."}</div></div><button className="housing-secondary" onClick={() => { setCategoryEntered(false); resetWorkspace(); }}>건물로 돌아가기</button></div>
      {category === "공용공간" && spacesLoading ? <p className="housing-empty" role="status">공용공간을 불러오고 있어요…</p>
        : category === "공용공간" && spacesError ? <p className="housing-error" role="alert">{spacesError}<button onClick={() => { setSpacesLoading(true); setRetry(n => n + 1); }}>다시 불러오기</button></p>
        : category === "공용공간" && currentSpaces.length ? <div className="housing-category-cards">{currentSpaces.map(s => <button key={s.code} onClick={() => { setFloor(s.floorLabel ?? "기타"); setSelectedCode(s.code); }}><b>{spaceLabel(s)}</b><span>민원 {buildingReports.filter(r => belongsTo(r, s)).length}건</span><strong>공간 선택 →</strong></button>)}</div>
        : <><div className="housing-subtitle">접수된 민원 {categoryReports.length}건</div>{categoryReports.length ? <section className="housing-category-reports">{categoryReports.map(r => <button key={r.id} className="analysis-report" onClick={() => navigate(`/admin/reports/${r.id}`)}><span><b>{r.summary ?? "공간 민원"}</b><small className="block">{r.locationDescription ?? r.space?.name ?? "위치 미등록"}</small></span><small>{REPORT_STATUS_LABEL[r.status]} →</small></button>)}</section> : <p className="housing-empty">{category === "공용공간" ? "이 건물에 등록된 공용공간과 민원이 없어요." : `아직 ${category}으로 접수된 민원이 없어요.`}</p>}</>}
    </main> : !floor ? <main className="housing-content">
      <div className="housing-heading"><div><p>{applied.district} · {dongOf(building)}</p><h1>{building.name}</h1><div className="housing-subtitle">공간 유형과 상세 공간을 선택해 민원 현황을 확인하세요.</div></div></div>
      <section className="housing-building"><span className="map-placeholder">{building.name} 건물 이미지</span><div className="building-stat"><span>등록된 민원</span><b>{buildingReports.length}건</b><small>공간을 선택하면 상세 집계를 볼 수 있어요</small></div></section>
      <div className="housing-category-cards">{(["공용공간", "거주공간", "주변공간"] as SpaceCategory[]).map(name => <button key={name} className={category === name ? "active" : ""} onClick={() => enterCategory(name)}><b>{name}</b><span>{name === "공용공간" && spacesLoading ? "공간 정보 불러오는 중…" : spaceCategorySummary(name, buildingReports, currentSpaces)}</span><strong>공간 선택 →</strong></button>)}</div>
      {spacesLoading && <p className="housing-empty" role="status">상세 공간을 불러오고 있어요…</p>}
      {spacesError && <p className="housing-error" role="alert">{spacesError}</p>}
    </main> : <div className={`housing-workspace ${panel ? "with-panel" : ""}`}>
      <main className={chat ? "housing-chat" : "housing-content floor-content"}>
        {chat ? <><div className="chat-heading"><b>민원 분석 AI</b><button className="housing-icon-button" aria-label="대화 닫기" onClick={() => setChat(false)}><X size={19} /></button></div>
          <div className="chat-messages" aria-live="polite"><div className="chat-intro"><BrandMark /><div className="chat-bubble"><b>무엇을 도와드릴까요?</b><p>선택한 공간의 민원 {scopedReports.length}건을 바탕으로 답변해 드려요.</p></div></div>
            <div className="chat-suggestions">{["가장 많은 민원", "주요 불편 이유", "엑셀로 정리"].map(q => <button key={q} onClick={() => ask(q)}>{q}</button>)}</div>
            {messages.map((m, i) => <Fragment key={i}><div className="chat-user">{m.question}</div><div className="chat-bubble answer">{m.answer}</div></Fragment>)}
          </div><form className="chat-compose" onSubmit={e => { e.preventDefault(); ask(question); }}><div><input aria-label="AI 질문 입력" placeholder="선택한 공간의 민원에 대해 질문해 보세요" value={question} onChange={e => setQuestion(e.target.value)} /><button disabled={!question.trim()} aria-label="보내기"><ArrowUp size={21} /></button></div><small>현재는 등록된 민원을 집계한 기본 요약을 제공합니다. AI 연동 준비 중.</small></form>
        </> : <><div className="housing-heading"><div><p>{building.name} · {category}</p><h1>{panel ? spaceLabel(selectedSpace ?? floorSpaces[0]) : `${floor} (${floorSpaces.map(s => s.name).join(", ")})`}</h1></div><button className={panel ? "housing-text-button" : "housing-secondary"} onClick={() => { if (panel) setPanel(false); else { setCategoryEntered(false); resetWorkspace(); } }}>{panel ? "← 전체 도면" : "건물로 돌아가기"}</button></div>
          <section className={`housing-floor ${panel ? "expanded" : ""}`} aria-label={`${floor} 공간 선택`}>
            <span className="floor-placeholder">{floor} 층 도면</span>
              {floorSpaces.map((s, i) => <button key={s.code} className={`complaint-pin ${s.code === selectedCode ? "selected" : ""}`}
                style={{ left: `${floorSpaces.length <= 2 ? (panel ? 19 + i * 53 : 28 + i * 36) : 12 + (i % 3) * 32}%`, top: `${floorSpaces.length <= 2 ? (panel ? 24 + i * 23 : 40 + i * 8) : 24 + Math.floor(i / 3) * 40}%` }}
                aria-pressed={s.code === selectedCode} onClick={() => { setSelectedCode(s.code); setMessages([]); }}>
                <span className="pin-drop"><span><b>{buildingReports.filter(r => belongsTo(r, s)).length}</b><small>건</small></span></span>
                <span className="pin-caption"><b>{spaceLabel(s)}</b><small>{buildingReports.filter(r => belongsTo(r, s)).length}건</small></span>
                <span className="pin-selection">{s.code === selectedCode ? "선택됨" : "선택"}</span>
              </button>)}
          </section>
          {!panel && <div className="floor-footer"><button className="housing-primary" disabled={!selectedSpace} onClick={() => setPanel(true)}>민원 상세보기</button></div>}
        </>}
      </main>
      {panel && <aside className="housing-analysis"><div className="analysis-heading"><div><p>선택 공간 분석</p><h2>민원 분석</h2></div><button className="housing-icon-button" aria-label="분석 패널 닫기" onClick={() => { setPanel(false); setChat(false); }}><X size={20} /></button></div>
        <div className="analysis-body"><section className="analysis-location"><p>{applied.district} › {building.name} › {category} ›</p><h3>{selectedSpace ? spaceLabel(selectedSpace) : floor}</h3></section>
          <section className="analysis-stats"><div><span>민원</span><b>{scopedReports.length} <small>건</small></b></div><div><span>제기</span><b>— <small>세대</small></b></div><div><span>반복 문제</span><b>{problems.filter(([, n]) => n > 1).length} <small>개</small></b></div><div><span>처리 현황</span><strong>검토 {scopedReports.filter(r => r.status !== "RESOLVED").length} · 완료 {scopedReports.filter(r => r.status === "RESOLVED").length}</strong></div></section>
          <SpaceAnalysisSections analysis={spaceAnalysis} onReview={setReviewIds}>
          <section className="analysis-section"><h3>대표 원문 <small>접수 원문</small></h3>{scopedReports.filter(r => r.description?.trim()).slice(0, 2).map(r => <blockquote key={r.id}>{r.description}</blockquote>)}{!scopedReports.some(r => r.description?.trim()) && <p className="housing-muted">등록된 민원 원문이 없어요.</p>}</section>
          </SpaceAnalysisSections>
        </div><div className="analysis-action"><button className="housing-primary" onClick={() => setChat(true)}>AI 챗봇으로 정리하기</button></div>
      </aside>}
    </div>}
    {reviewIds.length > 0 && <div className="housing-modal-backdrop" onClick={() => setReviewIds([])}><section className="housing-modal analysis-review-modal" role="dialog" aria-modal="true" aria-label="코드북 미분류 민원 검토" onClick={e => e.stopPropagation()}><div><h2>코드북 미분류 민원 검토</h2><button autoFocus aria-label="검토 닫기" onClick={() => setReviewIds([])}><X size={20} /></button></div><p>선택한 공간에서 미분류된 민원의 원문을 확인하세요.</p>{reviewReports.map(r => <Link key={r.id} className="analysis-report" to={`/admin/reports/${r.id}`}><span>{r.summary ?? "공간 민원"}</span><small>원문 확인 →</small></Link>)}{!reviewReports.length && <p>현재 목록에서 해당 민원을 찾을 수 없어요.</p>}</section></div>}
    {account && <div className="housing-modal-backdrop" onClick={() => setAccount(false)}><section className="housing-modal" role="dialog" aria-modal="true" aria-label="마이페이지" onClick={e => e.stopPropagation()}><div><h2>마이페이지</h2><button autoFocus aria-label="닫기" onClick={() => setAccount(false)}><X size={20} /></button></div><p>관리자 계정으로 접속 중입니다.</p><button className="housing-primary" onClick={() => setAccount(false)}>확인</button></section></div>}
  </div>;
}
