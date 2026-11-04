import { http } from "./http";
import type { Building, BuildingSpace, BuildingUnit, Region } from "@/types";

export const buildingApi = {
  regions: () => http.get<Region[]>("/buildings/regions"),
  list: (sido?: string, sigungu?: string) => {
    const params = new URLSearchParams();
    if (sido) params.set("sido", sido);
    if (sigungu) params.set("sigungu", sigungu);
    const query = params.toString();
    return http.get<Building[]>(`/buildings${query ? `?${query}` : ""}`);
  },
  get: (id: number) => http.get<Building>(`/buildings/${id}`),
  spaces: (id: number) => http.get<BuildingSpace[]>(`/buildings/${id}/spaces`),
  /** 단지의 세대 전체 — 호수를 입력하는 동안 바로 확인한다 */
  units: (id: number) => http.get<BuildingUnit[]>(`/buildings/${id}/units`),
  lookupUnit: (id: number, ho: string, dong?: string) => {
    const params = new URLSearchParams({ ho });
    if (dong) params.set("dong", dong);
    return http.get<BuildingUnit>(`/buildings/${id}/units/lookup?${params.toString()}`);
  },
};
