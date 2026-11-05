import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { adminApi, type AdminSpaceMap } from "@/api/admin";
import type { Report } from "@/types";
import SceneViewer, { type SceneMarker } from "@/components/scene/SceneViewer";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import RiskBadge from "@/components/common/RiskBadge";
import { markerColor, markerFaded } from "@/utils/reportMarker";

type StatusFilter = "all" | "unresolved";

const SELECT =
  "select-chevron h-9 rounded-[10px] border border-gray-200 bg-white px-3 text-sm text-neutral-800 outline-none transition focus:border-sogang-500 disabled:bg-neutral-50";

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

/**
 * 한 청년주택의 3D 장면에 접수된 신고 핀을 전부 띄운다.
 * 전체 / 미처리, 월별로 걸러 볼 수 있고, 핀이나 목록을 누르면 신고를 고른다.
 */
export default function AdminBuildingScene3D({ buildingId, onOpenReport, initialSceneId, sceneId: fixedSceneId, showSceneTabs = true, sceneClassName = "h-[560px]" }: {
  buildingId: number;
  onOpenReport: (reportId: number) => void;
  /** 처음 보여줄 장면. 없으면 신고가 가장 많은 장면 */
  initialSceneId?: string | null;
  /** 바깥(상세 공간 버튼)에서 고른 장면. 주면 이 장면만 보여준다 */
  sceneId?: string | null;
  /** 장면 선택 버튼 줄. 첫 화면은 상단 상세 공간 버튼으로 고르므로 끈다 */
  showSceneTabs?: boolean;
  sceneClassName?: string;
}) {
  const [map, setMap] = useState<AdminSpaceMap | null>(null);
  const [pickedSceneId, setSceneId] = useState<string | null>(null);
  const sceneId = fixedSceneId ?? pickedSceneId;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [month, setMonth] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi.spaceMap(buildingId)
      .then((data) => {
        if (cancelled) return;
        setMap(data);
        const counts = new Map<string, number>();
        data.reports.forEach((r) => { const id = r.space?.sceneId; if (id) counts.set(id, (counts.get(id) ?? 0) + 1); });
        const busiest = [...data.scenes].sort((a, b) => (counts.get(b.sceneId) ?? 0) - (counts.get(a.sceneId) ?? 0))[0];
        const preferred = initialSceneId && data.scenes.some((s) => s.sceneId === initialSceneId) ? initialSceneId : null;
        setSceneId(preferred ?? busiest?.sceneId ?? null);
        setSelectedId(null);
        setMonth("");
        setError(null);
      })
      .catch((cause) => {
        if (!cancelled) setError({ id: buildingId, message: cause instanceof Error ? cause.message : "신고 지도를 불러오지 못했습니다." });
      });
    return () => { cancelled = true; };
  }, [buildingId, initialSceneId]);

  const currentMap = map && map.building.id === buildingId ? map : null;
  const currentError = error?.id === buildingId ? error.message : null;

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
  const markers: SceneMarker[] = useMemo(() => inScene.map((r) => ({
    id: r.id, x: r.space!.pin!.x, y: r.space!.pin!.y, z: r.space!.pin!.z, color: markerColor(r), faded: markerFaded(r),
  })), [inScene]);
  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  if (currentError) return <p className="rounded-[10px] bg-white px-4 py-3 text-sm text-red-600">{currentError}</p>;
  if (!currentMap) {
    return <div className={`flex ${sceneClassName} items-center justify-center rounded-[16px] bg-[#e5e8eb] text-sm text-neutral-500`}>3D 지도를 불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {([["all", "전체"], ["unresolved", "미처리"]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setStatusFilter(value)}
              className={`h-9 rounded-[10px] px-4 text-sm font-semibold tracking-[-0.4px] transition ${
                statusFilter === value ? "bg-sogang-50 text-sogang-500" : "bg-[#f2f4f6] text-[#4e5968]"
              }`}>
              {label}
            </button>
          ))}
          <select aria-label="월" className={`${SELECT} w-36`} value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">전체 기간</option>
            {months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <Legend color="#e5484d" label="높음" />
          <Legend color="#f2994a" label="중간" />
          <Legend color="#e8b931" label="낮음" />
          <Legend color="#9e9e9e" label="처리완료(반투명)" faded />
          <span className="ml-1 font-medium text-neutral-800">신고 {fixedSceneId ? inScene.length : filtered.length}건</span>
        </div>
      </div>

      {currentMap.building.has3d ? (
        <>
          {showSceneTabs && <div className="flex flex-wrap gap-2">
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
          </div>}

          <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              {sceneId && (
                <SceneViewer
                  sceneId={sceneId}
                  mode="view"
                  markers={markers}
                  selectedId={selectedId}
                  onMarkerClick={setSelectedId}
                  className={`${sceneClassName} w-full rounded-[16px] border border-gray-200`}
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
        </>
      ) : (
        <>
          <p className="rounded-[10px] bg-[#f2f4f6] px-4 py-3 text-sm text-neutral-600">
            이 청년주택은 아직 3D 평면이 없어요. 접수된 신고를 목록으로 보여드려요.
          </p>
          <ReportList title={`신고 ${filtered.length}건`} reports={filtered} onOpen={onOpenReport} wide />
        </>
      )}
    </div>
  );
}

function Legend({ color, label, faded }: { color: string; label: string; faded?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color, opacity: faded ? 0.35 : 1 }} />
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
    <section className={`${wide ? "w-full" : "w-full lg:w-[340px] lg:shrink-0"} rounded-[16px] border border-[#e5e8eb] bg-white p-4`}>
      <p className="text-xs font-medium tracking-[-0.4px] text-neutral-500">{title}</p>
      {selected && (
        <div className="mt-3 rounded-[10px] border border-sogang-500 bg-sogang-50 p-3">
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
                selectedId === report.id ? "bg-sogang-50" : "hover:bg-[#f9fafb]"
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
