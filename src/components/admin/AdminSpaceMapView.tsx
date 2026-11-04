import { useEffect, useState } from "react";
import { buildingApi } from "@/api";
import { adminApi, type AdminMe } from "@/api/admin";
import type { Building, Region } from "@/types";
import AdminBuildingScene3D from "@/components/admin/AdminBuildingScene3D";

const SELECT =
  "select-chevron h-10 rounded-[10px] border border-gray-200 bg-white px-3 text-sm text-neutral-800 outline-none transition focus:border-sogang-500 disabled:bg-neutral-50";
const LAST_KEY = "dasigochim_admin_map_building";

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
 */
export default function AdminSpaceMapView({ onOpenReport }: { onOpenReport: (reportId: number) => void }) {
  const [last] = useState(readLast);
  const [regions, setRegions] = useState<Region[]>([]);
  const [sido, setSido] = useState(last?.sido ?? "");
  const [sigungu, setSigungu] = useState(last?.sigungu ?? "");
  const [housings, setHousings] = useState<{ key: string; items: Building[] } | null>(null);
  const [buildingId, setBuildingId] = useState<number | "">(last?.buildingId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([buildingApi.regions(), adminApi.me()])
      .then(([items, admin]) => {
        if (cancelled) return;
        setMe(admin);
        // 담당 범위 밖 지역은 고를 수 없게 뺀다.
        setRegions(admin.role === "SUPER" ? items : items
          .map((r) => ({ ...r, sigungus: r.sigungus.filter((g) => admin.scopes.some((s) =>
            (s.buildingId ? s.buildingSido === r.sido && s.buildingSigungu === g : s.sido === r.sido && (!s.sigungu || s.sigungu === g)))) }))
          .filter((r) => r.sigungus.length));
      })
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

  const sigungus = regions.find((region) => region.sido === sido)?.sigungus ?? [];
  const housingItems = (housings?.key === regionKey ? housings.items : []).filter((b) => !me || me.role === "SUPER"
    || me.scopes.some((s) => s.buildingId ? s.buildingId === b.id : b.sido === s.sido && (!s.sigungu || b.sigungu === s.sigungu)));
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

      {buildingId === "" ? (
        <div className="flex h-[420px] items-center justify-center rounded-[10px] bg-gray-10 text-sm text-neutral-500">
          지역과 청년주택을 고르면 3D 지도에 신고 핀이 표시돼요.
        </div>
      ) : (
        <AdminBuildingScene3D buildingId={buildingId} onOpenReport={onOpenReport} />
      )}
    </div>
  );
}
