import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { adminApi, type AdminMe } from "@/api/admin";
import { buildingApi } from "@/api/buildings";
import type { Building, BuildingSpace, Region, Report } from "@/types";
import { REPORT_STATUS_LABEL } from "@/types";
import AdminChatWidget, { type ChatCategory } from "@/components/admin/AdminChatWidget";
import AreaDashboard from "@/components/admin/AreaDashboard";
import AdminTopNav from "@/components/admin/AdminTopNav";
import AdminBuildingScene3D from "@/components/admin/AdminBuildingScene3D";
import RegionKakaoMap from "@/components/admin/RegionKakaoMap";
import SceneViewer from "@/components/scene/SceneViewer";
import { markerColor } from "@/utils/reportMarker";
import { complaintText } from "@/utils/reportDescription";
import SpaceAnalysisSections, { type SpaceAnalysisData } from "@/components/admin/SpaceAnalysisSections";
import { reportCategory, spaceCategorySummary, type SpaceCategory } from "@/utils/spaceCategorySummary";

type Selection = { sido: string; district: string; building: string };
const initial: Selection = { sido: "서울특별시", district: "", building: "" };
const positions = [[44, 39], [25, 22], [18, 54], [59, 61]];
const spaceLabel = (s: BuildingSpace) => `${s.floorLabel ?? ""} ${s.name}`.trim();
const belongsTo = (r: Report, s: BuildingSpace) => r.space?.code === s.code || (!r.space?.code && r.space?.name === s.name);
/** 담당 범위 안 단지인지 */
function inScope(me: AdminMe, b: Building) {
  if (me.role === "SUPER") return true;
  return me.scopes.some(s => s.buildingId ? s.buildingId === b.id : b.sido === s.sido && (!s.sigungu || b.sigungu === s.sigungu));
}

/** 첫 화면 = 담당 구역의 맨 위 (전체 관리자는 서울 전체) */
function rootOf(me: AdminMe, buildings: Building[]): Selection {
  const first = me.scopes[0];
  if (me.role === "SUPER" || !first) return initial;
  if (first.buildingId) {
    const b = buildings.find(x => x.id === first.buildingId);
    return { sido: first.buildingSido ?? b?.sido ?? initial.sido, district: first.buildingSigungu ?? b?.sigungu ?? "", building: String(first.buildingId) };
  }
  return { sido: first.sido ?? initial.sido, district: me.scopes.length === 1 ? first.sigungu ?? "" : "", building: "" };
}

function groupProblems(reports: Report[]) {
  const groups = new Map<string, number>();
  reports.forEach(r => { const title = r.summary ?? "내용 미분류"; groups.set(title, (groups.get(title) ?? 0) + 1); });
  return [...groups].sort((a, b) => b[1] - a[1]);
}

export default function HousingAnalysisPage({ spaceAnalyses = {} }: { spaceAnalyses?: Readonly<Record<string, SpaceAnalysisData>> }) {
  const navigate = useNavigate();
  // 상단 탭: 대시보드(기본) / 민원 지도(지도 · 3D · 신고). 주소에 남겨 새로고침·뒤로가기에도 유지한다.
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "map" ? "map" : "dashboard";
  const setView = (next: "dashboard" | "map") => setParams(prev => { const p = new URLSearchParams(prev); if (next === "map") p.set("view", "map"); else p.delete("view"); return p; }, { replace: true });
  const [selection, setSelection] = useState<Selection>(initial);
  const [applied, setApplied] = useState<Selection>(initial);
  const [regions, setRegions] = useState<Region[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [spaces, setSpaces] = useState<BuildingSpace[]>([]);
  const [category, setCategory] = useState("전체");
  const [categoryEntered, setCategoryEntered] = useState(false);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState("");
  const [floor, setFloor] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [panel, setPanel] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [reviewIds, setReviewIds] = useState<number[]>([]);
  const [me, setMe] = useState<AdminMe | null>(null);
  // 거주공간 상세 공간 = 세대 타입별 3D 장면
  const [units, setUnits] = useState<{ buildingId: number; list: { sceneId: string; label: string }[] } | null>(null);
  const [unitScene, setUnitScene] = useState("");
  const [root, setRoot] = useState<Selection>(initial);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [rs, bs, first, admin] = await Promise.all([buildingApi.regions(), buildingApi.list(), adminApi.reports({ size: 100 }), adminApi.me()]);
        const all = [...first.content];
        for (let page = 1; page < first.totalPages && active; page++) {
          const next = await adminApi.reports({ size: 100, page });
          all.push(...next.content);
        }
        if (active) {
          // 담당 범위 밖 단지·지역은 화면에서도 뺀다 (신고는 서버가 이미 걸러 준다).
          const scoped = bs.filter(b => inScope(admin, b));
          const scopedRegions = admin.role === "SUPER" ? rs : rs
            .map(r => ({ ...r, sigungus: r.sigungus.filter(g => scoped.some(b => b.sido === r.sido && b.sigungu === g)) }))
            .filter(r => r.sigungus.length);
          const start = rootOf(admin, scoped);
          setMe(admin); setRegions(scopedRegions); setBuildings(scoped); setReports(all); setError("");
          setRoot(start); setSelection(start); setApplied(start); setSpacesLoading(Boolean(start.building));
        }
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

  useEffect(() => {
    const id = Number(applied.building);
    if (!id) return;
    let active = true;
    buildingApi.units(id).then(list => {
      if (!active) return;
      const byScene = new Map<string, Set<string>>();
      list.forEach(u => { const set = byScene.get(u.sceneId) ?? new Set<string>(); set.add(u.unitType); byScene.set(u.sceneId, set); });
      // 작은 평형부터 (18A → 18B → 19 → … → 52·64)
      const size = (t: string) => parseFloat(t) + (/[B-Z]$/i.test(t) ? 0.5 : 0);
      const scenes = [...byScene].map(([sceneId, types]) => {
        const sorted = [...types].sort((a, b) => size(a) - size(b));
        return { sceneId, label: `세대 ${sorted.join("·")} TYPE`, order: size(sorted[0]) };
      }).sort((a, b) => a.order - b.order).map(({ sceneId, label }) => ({ sceneId, label }));
      setUnits({ buildingId: id, list: scenes });
    }).catch(() => { if (active) setUnits({ buildingId: id, list: [] }); });
    return () => { active = false; };
  }, [applied.building]);

  const currentSpaces = spaces;
  const building = buildings.find(b => String(b.id) === applied.building);
  const availableBuildings = buildings.filter(b => (!selection.sido || b.sido === selection.sido) && (!selection.district || b.sigungu === selection.district));
  const housingOptions = availableBuildings;
  const buildingReports = reports.filter(r => r.building?.id === building?.id);
  const categoryReports = buildingReports.filter(r => reportCategory(r, currentSpaces) === category);
  const selectedSpace = currentSpaces.find(s => s.code === selectedCode);
  const scopedReports = selectedSpace ? buildingReports.filter(r => belongsTo(r, selectedSpace)) : buildingReports;
  // Analysis is scoped by both building and space to prevent cross-building results.
  const spaceAnalysis = building && selectedSpace ? spaceAnalyses[`${building.id}:${selectedSpace.code}`] : undefined;
  const reviewReports = scopedReports.filter(r => reviewIds.includes(r.id));
  const categorySpaces = category === "공용공간" ? currentSpaces : [];
  const unitScenes = units && String(units.buildingId) === applied.building ? units.list : [];
  const activeUnitScene = unitScenes.some(u => u.sceneId === unitScene) ? unitScene : unitScenes[0]?.sceneId ?? "";
  const floorSpaces = categorySpaces.filter(s => (s.floorLabel ?? "기타") === floor);
  const problems = groupProblems(scopedReports);
  // 담당 범위에 따라 잠그는 선택 칸
  const lockSido = !!me && me.role !== "SUPER" && regions.length <= 1;
  const lockDistrict = !!me && (me.role === "BUILDING" || (me.role === "REGION" && me.scopes.length === 1 && !!me.scopes[0].sigungu));
  const lockBuilding = !!me && me.role === "BUILDING" && buildings.length <= 1;
  const regionLabel = applied.district ? `${applied.sido} ${applied.district}` : `${applied.sido.replace("특별시", "시")} 전체`;
  // 오른쪽 아래 챗봇이 처음 열릴 때 쓸 지금 화면의 범위
  const chatCategory = (categoryEntered || floor) && ["공용공간", "거주공간", "주변공간"].includes(category) ? category as ChatCategory : undefined;
  const pageScope = { sido: applied.sido, district: applied.district || undefined, buildingId: building?.id, category: building ? chatCategory : undefined };
  // 층 화면의 3D 장면: 고른 공간(없으면 그 층 첫 공간)의 장면에 그 공간 신고 핀을 띄운다.
  const sceneSpace = selectedSpace ?? floorSpaces[0];
  const spaceMarkers = sceneSpace ? buildingReports.filter(r => belongsTo(r, sceneSpace) && r.space?.sceneId === sceneSpace.sceneId && r.space.pin)
    .map(r => ({ id: r.id, x: r.space!.pin!.x, y: r.space!.pin!.y, z: r.space!.pin!.z, color: markerColor(r) })) : [];
  const countBuilding = (id: number) => reports.filter(r => r.building?.id === id).length;
  const countDistrict = (district: string) => reports.filter(r => buildings.some(b => b.id === r.building?.id && b.sido === applied.sido && b.sigungu === district)).length;
  const scopedBuildings = buildings.filter(b => b.sido === applied.sido && (!applied.district || b.sigungu === applied.district));
  const districtNames = regions.find(r => r.sido === applied.sido)?.sigungus ?? [];
  const resetWorkspace = () => { setFloor(""); setSelectedCode(""); setPanel(false); };
  const apply = (value: Selection) => {
    if (value.building !== applied.building) { setSpaces([]); setSpacesError(""); setSpacesLoading(Boolean(value.building)); }
    setSelection(value); setApplied(value); setCategory("전체"); setCategoryEntered(false); resetWorkspace();
  };
  const enterCategory = (value: string) => {
    if (value === "전체") { setCategory("전체"); setCategoryEntered(false); resetWorkspace(); return; }
    setCategory(value); setCategoryEntered(true); resetWorkspace();
    if (value === "공용공간" && currentSpaces.length) {
      setFloor(currentSpaces[0].floorLabel ?? "기타"); setSelectedCode(currentSpaces[0].code);
    }
  };
  const pickFloor = (value: string) => {
    setFloor(value); setSelectedCode(categorySpaces.find(s => (s.floorLabel ?? "기타") === value)?.code ?? "");
    if (category === "전체") setCategory("공용공간");
    setPanel(false);
  };
  const setField = (key: keyof Selection, value: string) => {
    setSelection(prev => key === "sido" ? { sido: value, district: "", building: "" } : key === "district" ? { ...prev, district: value, building: "" } : { ...prev, building: value });
  };
  // 대시보드는 지금 조회한 범위(시·도 / 시·군·구 / 청년주택)를 그대로 따른다.
  const selectionBuildings = building ? [building] : scopedBuildings;
  const selectionIds = new Set(selectionBuildings.map(b => b.id));
  const selectionReports = reports.filter(r => r.building?.id !== undefined && selectionIds.has(r.building.id));
  const total = scopedBuildings.reduce((n, b) => n + countBuilding(b.id), 0);
  return <div className="housing-app">
    <AdminTopNav active={view} me={me} onTab={setView} onBrand={() => apply(root)} />
    <form className="housing-filters" onSubmit={e => { e.preventDefault(); apply(selection); }}>
      <div className="housing-filter-row">
        {([
          ["sido", "시·도", [...new Set(["서울특별시", ...regions.map(r => r.sido)])].map(v => [v, v]), false],
          ["district", "시·군·구", (regions.find(r => r.sido === selection.sido)?.sigungus ?? []).map(v => [v, v]), false],
          ["building", "청년안심주택", housingOptions.map(b => [String(b.id), b.name]), !selection.district],
        ] as [keyof Selection, string, string[][], boolean][]).map(([key, label, options, disabled]) => [key, label, options,
          disabled || (key === "sido" && lockSido) || (key === "district" && lockDistrict) || (key === "building" && lockBuilding)] as const).map(([key, label, options, disabled], index) => <Fragment key={key}>
          {index > 0 && <span className="filter-arrow" aria-hidden="true">→</span>}
          <label className={`housing-select ${disabled ? "is-disabled" : ""}`}><span>{label}</span>
            <select value={selection[key]} disabled={disabled || loading} onChange={e => setField(key, e.target.value)}>
              {key !== "sido" && !(key === "district" && lockDistrict) && !(key === "building" && lockBuilding) && <option value="">전체</option>}
              {options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
            </select>
          </label>
        </Fragment>)}
        <button className="housing-primary query-button" disabled={loading}>조회하기</button>
      </div>
      {building && view === "map" && <div className="housing-space-filters">
        <div className="housing-space-filter-row" role="group" aria-label="공간 유형">
          <span className="housing-space-filter-label">공간 유형</span>
          <div className="housing-space-filter-options">
        {["전체", "공용공간", "거주공간", "주변공간"].map(c => <button type="button" className={`housing-chip ${(categoryEntered || floor ? category === c : c === "전체") ? "active" : ""}`} key={c} onClick={() => enterCategory(c)}>{c}</button>)}
          </div>
        </div>
        {/* 상세 공간은 공간 유형을 골랐을 때만 — 공용공간은 층별 공간, 거주공간은 세대 타입 */}
        {((category === "공용공간" && categorySpaces.length > 0) || (category === "거주공간" && categoryEntered && unitScenes.length > 0) || spacesLoading) &&
          <div className="housing-space-filter-row" role="group" aria-label="상세 공간">
            <span className="housing-space-filter-label">상세 공간</span>
            <div className="housing-space-filter-options">
              {category === "공용공간" && [...new Set(categorySpaces.map(s => s.floorLabel ?? "기타"))].map(f => <button type="button" key={f} className={`housing-chip ${floor === f ? "active" : ""}`} onClick={() => pickFloor(f)}>{f} {categorySpaces.find(s => (s.floorLabel ?? "기타") === f)?.name}</button>)}
              {category === "거주공간" && categoryEntered && unitScenes.map(u => <button type="button" key={u.sceneId} className={`housing-chip ${activeUnitScene === u.sceneId ? "active" : ""}`} onClick={() => setUnitScene(u.sceneId)}>{u.label}</button>)}
              {spacesLoading && <small role="status">공간 불러오는 중…</small>}
            </div>
          </div>}
      </div>}
    </form>
    {error && <div className="housing-error" role="alert">{error} <button onClick={() => { setError(""); setLoading(true); setRetry(n => n + 1); }}>다시 불러오기</button></div>}
    {loading ? <main className="housing-content"><p className="housing-empty" role="status">민원 현황을 불러오고 있어요…</p></main>
    : view === "dashboard" ? (error ? null : <AreaDashboard key={`${applied.sido}|${applied.district}|${applied.building}`}
        title={building?.name ?? regionLabel} subtitle={building ? building.address ?? regionLabel : undefined}
        reports={selectionReports} buildings={selectionBuildings}
        onSelectBuilding={building ? undefined : id => apply({ ...applied, district: buildings.find(b => b.id === id)?.sigungu ?? applied.district, building: String(id) })} />)
    : !building ? <main className="housing-content">
      <div className="housing-heading"><div><p>{regionLabel}</p><h1>{applied.district ? "청년안심주택별 민원 현황" : "시·군·구별 민원 현황"}</h1></div></div>
      <RegionKakaoMap
        area={applied.district ? `${applied.sido} ${applied.district}` : applied.sido}
        level={applied.district ? 6 : 9}
        markers={error ? [] : applied.district
          ? scopedBuildings.map(b => ({ key: String(b.id), label: b.name, count: countBuilding(b.id), address: b.address || `${b.sido ?? ""} ${b.sigungu ?? ""}` }))
          : districtNames.map(name => ({ key: name, label: name, count: countDistrict(name), address: `${applied.sido} ${name}` }))}
        onSelect={key => apply(applied.district ? { ...applied, building: key } : { ...applied, district: key, building: "" })}
        fallback={<>
      <section className="housing-map" aria-label={applied.district ? "주택 선택" : "시·군·구 선택"}>
        <span className="map-placeholder">{applied.district || applied.sido.replace("특별시", "시")} 지도</span>
        {!error && (applied.district ? scopedBuildings.map((b, i) => <button key={b.id} className={`housing-marker ${i === 0 ? "active" : ""}`} style={{ left: `${positions[i % positions.length][0]}%`, top: `${positions[i % positions.length][1] + Math.floor(i / positions.length) * 9}%` }} onClick={() => apply({ ...applied, building: String(b.id) })}><b>{countBuilding(b.id)}</b><span>{b.name}</span></button>)
        : (districtNames.map((name, i) => [name, countDistrict(name), 10 + (i % 5) * 18, 14 + Math.floor(i / 5) * 16] as const)).map(([name, count, x, y], i) => <button key={name} className={`housing-marker ${i === 0 ? "active" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => apply({ ...applied, district: name, building: "" })}><b>{count}</b><span>{name}</span></button>))}
        {!error && applied.district && !scopedBuildings.length && <p className="map-empty">등록된 청년안심주택이 없어요.</p>}
      </section>
        </>}>
        {!error && applied.district && !scopedBuildings.length && <p className="map-empty on-map">등록된 청년안심주택이 없어요.</p>}
      </RegionKakaoMap>
      <footer className="housing-map-footer"><span>{applied.district ? "주택 마커를 선택해 건물을 확인하세요." : "시·군·구 마커를 선택해 상세 현황을 확인하세요."}</span><b>총 {total}건</b></footer>
    </main> : !floor && categoryEntered ? <main className="housing-content">
      <div className="housing-heading"><div><h1>{category} 민원 현황</h1><div className="housing-subtitle">{category === "공용공간" ? "상세 공간을 선택해 민원 현황을 확인하세요." : "이 유형으로 접수된 민원을 확인하세요."}</div></div><button className="housing-secondary" onClick={() => { setCategoryEntered(false); setCategory("전체"); resetWorkspace(); }}>건물로 돌아가기</button></div>
      {category === "공용공간" && spacesLoading ? <p className="housing-empty" role="status">공용공간을 불러오고 있어요…</p>
        : category === "공용공간" && spacesError ? <p className="housing-error" role="alert">{spacesError}<button onClick={() => { setSpacesLoading(true); setRetry(n => n + 1); }}>다시 불러오기</button></p>
        : category === "공용공간" && currentSpaces.length ? <div className="housing-category-cards">{currentSpaces.map(s => <button key={s.code} onClick={() => { setFloor(s.floorLabel ?? "기타"); setSelectedCode(s.code); }}><b>{spaceLabel(s)}</b><span>민원 {buildingReports.filter(r => belongsTo(r, s)).length}건</span><strong>공간 선택 →</strong></button>)}</div>
        : category === "거주공간" && building.has3d && activeUnitScene ? <AdminBuildingScene3D key={activeUnitScene} buildingId={building.id} sceneId={activeUnitScene} showSceneTabs={false} onOpenReport={id => navigate(`/admin/reports/${id}`)} />
        : <><div className="housing-subtitle">접수된 민원 {categoryReports.length}건</div>{categoryReports.length ? <section className="housing-category-reports">{categoryReports.map(r => <button key={r.id} className="analysis-report" onClick={() => navigate(`/admin/reports/${r.id}`)}><span><b>{r.summary ?? "공간 민원"}</b><small className="block">{r.locationDescription ?? r.space?.name ?? "위치 미등록"}</small></span><small>{REPORT_STATUS_LABEL[r.status]} →</small></button>)}</section> : <p className="housing-empty">{category === "공용공간" ? "이 건물에 등록된 공용공간과 민원이 없어요." : `아직 ${category}으로 접수된 민원이 없어요.`}</p>}</>}
    </main> : !floor ? <main className="housing-content">
      <AdminBuildingScene3D buildingId={building.id} showSceneTabs={false} onOpenReport={id => navigate(`/admin/reports/${id}`)} />
      <nav className="housing-category-cards" aria-label="공간 유형별 이동">
        {(["공용공간", "거주공간", "주변공간"] as SpaceCategory[]).map(name => <button key={name} type="button" onClick={() => enterCategory(name)}>
          <b>{name}</b>
          <span>{name === "공용공간" && spacesLoading ? "공간 정보 불러오는 중…" : spaceCategorySummary(name, buildingReports, currentSpaces)}</span>
          <strong>공간 선택 →</strong>
        </button>)}
      </nav>
      {spacesError && <p className="housing-error" role="alert">{spacesError}</p>}
    </main> : <div className={`housing-workspace ${panel ? "with-panel" : ""}`}>
      <main className="housing-content floor-content">
        <><div className="housing-heading"><div><p>{category}</p><h1>{panel ? spaceLabel(selectedSpace ?? floorSpaces[0]) : `${floor} (${floorSpaces.map(s => s.name).join(", ")})`}</h1></div><button className={panel ? "housing-text-button" : "housing-secondary"} onClick={() => { if (panel) setPanel(false); else { setCategoryEntered(false); resetWorkspace(); } }}>{panel ? "← 전체 도면" : "건물로 돌아가기"}</button></div>
          {building.has3d && sceneSpace ? <>
            <div className="housing-space-pins" role="group" aria-label={`${floor} 공간 선택`}>{floorSpaces.map(s => <button key={s.code} type="button" className={`housing-chip ${s.code === selectedCode ? "active" : ""}`} aria-pressed={s.code === selectedCode} onClick={() => setSelectedCode(s.code)}>{spaceLabel(s)} · {buildingReports.filter(r => belongsTo(r, s)).length}건</button>)}</div>
            <SceneViewer sceneId={sceneSpace.sceneId} mode="view" markers={spaceMarkers} onMarkerClick={id => navigate(`/admin/reports/${id}`)} className={`housing-floor-3d ${panel ? "expanded" : ""}`} />
          </> : (
          <section className={`housing-floor ${panel ? "expanded" : ""}`} aria-label={`${floor} 공간 선택`}>
              <span className="floor-placeholder">{floor} 층 도면</span>
                {floorSpaces.map((s, i) => <button key={s.code} className={`complaint-pin ${s.code === selectedCode ? "selected" : ""}`}
                  style={{ left: `${floorSpaces.length <= 2 ? (panel ? 19 + i * 53 : 28 + i * 36) : 12 + (i % 3) * 32}%`, top: `${floorSpaces.length <= 2 ? (panel ? 24 + i * 23 : 40 + i * 8) : 24 + Math.floor(i / 3) * 40}%` }}
                  aria-pressed={s.code === selectedCode} onClick={() => setSelectedCode(s.code)}>
                  <span className="pin-drop"><span><b>{buildingReports.filter(r => belongsTo(r, s)).length}</b><small>건</small></span></span>
                  <span className="pin-caption"><b>{spaceLabel(s)}</b><small>{buildingReports.filter(r => belongsTo(r, s)).length}건</small></span>
                  <span className="pin-selection">{s.code === selectedCode ? "선택됨" : "선택"}</span>
                </button>)}
            </section>
          )}
          {!panel && <div className="floor-footer"><button className="housing-primary" disabled={!selectedSpace} onClick={() => setPanel(true)}>민원 상세보기</button></div>}
        </>
      </main>
      {panel && <aside className="housing-analysis"><div className="analysis-heading"><div><p>선택 공간 분석</p><h2>민원 분석</h2></div><button className="housing-icon-button" aria-label="분석 패널 닫기" onClick={() => setPanel(false)}><X size={20} /></button></div>
        <div className="analysis-body"><section className="analysis-location"><p>{applied.district} › {building.name} › {category} ›</p><h3>{selectedSpace ? spaceLabel(selectedSpace) : floor}</h3></section>
          <section className="analysis-stats"><div><span>민원</span><b>{scopedReports.length} <small>건</small></b></div><div><span>제기</span><b>— <small>세대</small></b></div><div><span>반복 문제</span><b>{problems.filter(([, n]) => n > 1).length} <small>개</small></b></div><div><span>처리 현황</span><strong>검토 {scopedReports.filter(r => r.status !== "RESOLVED").length} · 완료 {scopedReports.filter(r => r.status === "RESOLVED").length}</strong></div></section>
          <SpaceAnalysisSections analysis={spaceAnalysis} onReview={setReviewIds}>
          <section className="analysis-section"><h3>대표 원문 <small>접수 원문</small></h3>{scopedReports.filter(r => r.description?.trim()).slice(0, 2).map(r => <blockquote key={r.id}>{complaintText(r.description)}</blockquote>)}{!scopedReports.some(r => r.description?.trim()) && <p className="housing-muted">등록된 민원 원문이 없어요.</p>}</section>
          </SpaceAnalysisSections>
        </div>
      </aside>}
    </div>}
    {!loading && <AdminChatWidget regions={regions} buildings={buildings} reports={reports} pageScope={pageScope} />}
    {reviewIds.length > 0 && <div className="housing-modal-backdrop" onClick={() => setReviewIds([])}><section className="housing-modal analysis-review-modal" role="dialog" aria-modal="true" aria-label="코드북 미분류 민원 검토" onClick={e => e.stopPropagation()}><div><h2>코드북 미분류 민원 검토</h2><button autoFocus aria-label="검토 닫기" onClick={() => setReviewIds([])}><X size={20} /></button></div><p>선택한 공간에서 미분류된 민원의 원문을 확인하세요.</p>{reviewReports.map(r => <Link key={r.id} className="analysis-report" to={`/admin/reports/${r.id}`}><span>{r.summary ?? "공간 민원"}</span><small>원문 확인 →</small></Link>)}{!reviewReports.length && <p>현재 목록에서 해당 민원을 찾을 수 없어요.</p>}</section></div>}
  </div>;
}
