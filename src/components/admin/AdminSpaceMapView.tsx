import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { adminApi, type AdminSpaceMap } from "@/api/admin";
import { buildingApi } from "@/api";
import type { Building, Region, Report } from "@/types";
import SceneViewer, { type SceneMarker } from "@/components/scene/SceneViewer";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import RiskBadge from "@/components/common/RiskBadge";

type StatusFilter = "all" | "unresolved";

const SELECT =
  "select-chevron h-10 rounded-[10px] border border-gray-200 bg-white px-3 text-sm text-neutral-800 outline-none transition focus:border-sogang-500 disabled:bg-neutral-50";
const LAST_KEY = "dasigochim_admin_map_building";

/** 핀 색: 미처리는 위험도 색, 처리완료는 회색 */
function markerColor(report: Report) {
  if (report.status === "RESOLVED") return "#9e9e9e";
  if (report.riskLevel === "HIGH") return "#e5484d";
  if (report.riskLevel === "LOW") return "#e8b931";
  return "#f2994a";
}

function monthKey(report: Report) {
  const d = new Date(report.submittedAt ?? report.createdAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}

function readLast(): { sido: string; sigungu: string; buildingId: number } | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLast(value: { sido: string; sigungu: string; buildingId: number }) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(value));
  } catch {
    // 저장소를 못 쓰면 다음에 다시 고르면 된다.
  }
}

/**
 * 관리자 3D 지도 — 지역 · 청년주택을 고르면 그 단지의 3D 장면에 접수된 신고 핀을 전부 띄운다.
 * 예전 캠퍼스 지도 보기를 대신한다.
 */
export default function AdminSpaceMapView({ onOpenReport }: { onOpenReport: (reportId: number) => void }) {
  const [last] = useState(readLast);
  const [regions, setRegions] = useState<Region[]>([]);
  const [sido, setSido] = useState(last?.sido ?? "");
  const [sigungu, setSigungu] = useState(last?.sigungu ?? "");
  const [housings, setHousings] = useState<{ key: string; items: Building[] } | null>(null);
  const [buildingId, setBuildingId] = useState<number | "">(last?.buildingId ?? "");
  const [map, setMap] = useState<AdminSpaceMap | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [month, setMonth] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildingApi.regions()
      .then((items) => { if (!cancelled) setRegions(items); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "지역 목록을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, []);

  const regionKey = sido && sigungu ? `${sido}/${sigungu}` : "";
  useEffect(() => {
    if (!regionKey) return;
    let cancelled = false;
    const [s, g] = regionKey.split("/");
    buildingApi.list(s, g)
      .then((items) => { if (!cancelled) setHousings({ key: regionKey, items }); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "청년주택 목록을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [regionKey]);

  useEffect(() => {
    if (buildingId === "") return;
    let cancelled = false;
    adminApi.spaceMap(buildingId)
      .then((data) => {
        if (cancelled) return;
        setMap(data);
        // 신고가 가장 많은 장면부터 보여준다.
        const counts = new Map<string, number>();
        data.reports.forEach((r) => { const id = r.space?.sceneId; if (id) counts.set(id, (counts.get(id) ?? 0) + 1); });
        const busiest = [...data.scenes].sort((a, b) => (counts.get(b.sceneId) ?? 0) - (counts.get(a.sceneId) ?? 0))[0];
        setSceneId(busiest?.sceneId ?? null);
        setSelectedId(null);
        setMonth("");
        setError(null);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "신고 지도를 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [buildingId]);

  const sigungus = regions.find((region) => region.sido === sido)?.sigungus ?? [];
  const housingItems = housings?.key === regionKey ? housings.items : [];
  const currentMap = map && map.building.id === buildingId ? map : null;

  // 상태 · 월 필터를 건 신고
  const filtered = useMemo(() => {
    if (!currentMap) return [];
    return currentMap.reports.filter((report) =>
      (statusFilter === "all" || report.status !== "RESOLVED") && (!month || monthKey(report) === month));
  }, [currentMap, statusFilter, month]);

  const months = useMemo(() => {
    if (!currentMap) return [];
    return [...new Set(currentMap.reports.map(monthKey))].sort().reverse();
  }, [currentMap]);

  const countByScene = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((r) => { const id = r.space?.sceneId; if (id && r.space?.pin) counts.set(id, (counts.get(id) ?? 0) + 1); });
    return counts;
  }, [filtered]);

  const inScene = filtered.filter((r) => r.space?.sceneId === sceneId && r.space.pin);
  const withoutPin = filtered.filter((r) => !r.space?.sceneId || !r.space.pin);
  const markers: SceneMarker[] = useMemo(() => inScene.map((r) => ({
    id: r.id, x: r.space!.pin!.x, y: r.space!.pin!.y, z: r.space!.pin!.z, color: markerColor(r),
  })), [inScene]);
  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  const chooseBuilding = (value: string) => {
    const id = value ? Number(value) : "";
    setBuildingId(id);
    if (id !== "") saveLast({ sido, sigungu, buildingId: id });
  };

  return (
    <div className="mt-5 flex flex-col gap-4">
      {/* 지역 · 청년주택 */}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="시·도" className={`${SELECT} w-44`} value={sido}
          onChange={(e) => { setSido(e.target.value); setSigungu(""); setBuildingId(""); }}>
          <option value="">시·도</option>
          {regions.map((region) => <option key={region.sido} value={region.sido}>{region.sido}</option>)}
        </select>
        <select aria-label="시·군·구" className={`${SELECT} w-36`} value={sigungu} disabled={!sido}
          onChange={(e) => { setSigungu(e.target.value); setBuildingId(""); }}>
          <option value="">시·군·구</option>
          {sigungus.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select aria-label="청년주택" className={`${SELECT} min-w-72 flex-1`} value={buildingId} disabled={!regionKey}
          onChange={(e) => chooseBuilding(e.target.value)}>
          <option value="">
            {!regionKey ? "지역을 먼저 골라 주세요" : housingItems.length ? "청년주택을 선택해 주세요" : "이 지역에는 등록된 청년주택이 없어요"}
          </option>
          {housingItems.map((housing) => (
            <option key={housing.id} value={housing.id}>{housing.name}{housing.has3d ? " · 3D" : ""}</option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-[10px] bg-white px-4 py-3 text-sm text-sogang-500">{error}</p>}

      {!currentMap && !error && (
        <div className="flex h-[420px] items-center justify-center rounded-[10px] bg-gray-10 text-sm text-neutral-500">
          {buildingId === "" ? "지역과 청년주택을 고르면 3D 지도에 신고 핀이 표시돼요." : "불러오는 중..."}
        </div>
      )}

      {currentMap && (
        <>
          {/* 필터 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {([["all", "전체"], ["unresolved", "미처리"]] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setStatusFilter(value)}
                  className={`h-9 rounded-full border px-4 text-sm tracking-[-0.4px] transition ${
                    statusFilter === value ? "border-neutral-800 bg-white font-semibold text-neutral-800" : "border-gray-200 bg-white text-neutral-500 hover:border-gray-400"
                  }`}>
                  {label}
                </button>
              ))}
              <select aria-label="월" className={`${SELECT} h-9 w-36`} value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">전체 기간</option>
                {months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <Legend color="#e5484d" label="높음" />
              <Legend color="#f2994a" label="중간" />
              <Legend color="#e8b931" label="낮음" />
              <Legend color="#9e9e9e" label="처리완료" />
              <span className="ml-1 font-medium text-neutral-800">신고 {filtered.length}건</span>
            </div>
          </div>

          {currentMap.building.has3d ? (
            <>
              {/* 장면 */}
              <div className="flex flex-wrap gap-2">
                {currentMap.scenes.map((scene) => (
                  <button key={scene.sceneId} type="button"
                    onClick={() => { setSceneId(scene.sceneId); setSelectedId(null); }}
                    className={`flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-sm tracking-[-0.4px] transition ${
                      sceneId === scene.sceneId ? "border-sogang-500 bg-sogang-50 font-semibold text-sogang-500" : "border-gray-200 bg-white text-neutral-600 hover:border-gray-400"
                    }`}>
                    {scene.name}
                    <span className={`rounded-full px-1.5 text-[11px] ${countByScene.get(scene.sceneId) ? "bg-sogang-500 text-white" : "bg-neutral-100 text-neutral-400"}`}>
                      {countByScene.get(scene.sceneId) ?? 0}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  {sceneId && (
                    <SceneViewer
                      sceneId={sceneId}
                      mode="view"
                      markers={markers}
                      selectedId={selectedId}
                      onMarkerClick={setSelectedId}
                      className="h-[560px] w-full border border-gray-200"
                    />
                  )}
                </div>
                <ReportList
                  title={`이 장면의 신고 ${inScene.length}건`}
                  reports={inScene}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onOpen={onOpenReport}
                  selected={selected}
                />
              </div>
              {withoutPin.length > 0 && (
                <ReportList title={`3D 위치가 없는 신고 ${withoutPin.length}건`} reports={withoutPin} onOpen={onOpenReport} wide />
              )}
            </>
          ) : (
            <>
              <p className="rounded-[10px] bg-gray-10 px-4 py-3 text-sm text-neutral-600">
                이 청년주택은 아직 3D 평면이 없어요. 접수된 신고를 목록으로 보여드려요.
              </p>
              <ReportList title={`신고 ${filtered.length}건`} reports={filtered} onOpen={onOpenReport} wide />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ReportList({ title, reports, selectedId, onSelect, onOpen, selected, wide }: {
  title: string;
  reports: Report[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  onOpen: (id: number) => void;
  selected?: Report | null;
  wide?: boolean;
}) {
  return (
    <section className={`${wide ? "w-full" : "w-[340px] shrink-0"} rounded-[10px] bg-gray-10 p-4 shadow-[0px_2px_5px_0px_rgba(0,0,0,0.05)]`}>
      <p className="text-xs font-medium tracking-[-0.4px] text-neutral-500">{title}</p>
      {selected && (
        <div className="mt-3 rounded-[10px] border border-sogang-500 bg-white p-3">
          <p className="text-sm font-semibold text-neutral-800">{selected.summary ?? selected.locationDescription ?? "공간 민원"}</p>
          <p className="mt-1 text-xs text-neutral-500">{selected.locationDescription}</p>
          <button type="button" onClick={() => onOpen(selected.id)}
            className="mt-2 flex items-center gap-0.5 text-xs font-semibold text-sogang-500">
            상세 보기 <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
      <ul className={`mt-3 flex flex-col gap-1.5 overflow-y-auto ${wide ? "" : "max-h-[460px]"}`}>
        {reports.length === 0 && <li className="py-8 text-center text-sm text-neutral-400">조건에 맞는 신고가 없어요.</li>}
        {reports.map((report) => (
          <li key={report.id}>
            <button type="button"
              onClick={() => (onSelect ? onSelect(report.id) : onOpen(report.id))}
              onDoubleClick={() => onOpen(report.id)}
              className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition ${
                selectedId === report.id ? "bg-sogang-50" : "hover:bg-white"
              }`}>
              <RiskBadge level={report.riskLevel ?? "MEDIUM"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-neutral-800">
                  {report.summary ?? report.locationDescription ?? "공간 민원"}
                </span>
                <span className="block truncate text-[11px] text-neutral-500">
                  {formatDate(report.submittedAt)} · {report.space?.pin?.label ?? report.space?.name ?? report.locationDescription ?? ""}
                </span>
              </span>
              <AdminStatusBadge status={report.status} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
