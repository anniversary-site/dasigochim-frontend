import type { BuildingSpace, Report } from "@/types";

export type SpaceCategory = "공용공간" | "거주공간" | "주변공간";

export function reportCategory(report: Report, spaces: BuildingSpace[]): SpaceCategory | null {
  if (report.indoor === false) return "주변공간";
  if (report.space?.type === "UNIT") return "거주공간";
  if (report.space?.type === "COMMON" || spaces.some(s =>
    report.space?.code ? s.code === report.space.code : s.name === report.space?.name)) return "공용공간";
  return null;
}

/** Count distinct reported places, rather than all registered spaces or report rows. */
export function spaceCategorySummary(category: SpaceCategory, reports: Report[], spaces: BuildingSpace[]): string {
  const matching = reports.filter(r => reportCategory(r, spaces) === category);
  if (!matching.length) return "접수된 민원 없음";
  const counts = new Map<string, { name: string; count: number }>();
  for (const report of matching) {
    const registered = category === "공용공간" ? spaces.find(s =>
      report.space?.code ? s.code === report.space.code : s.name === report.space?.name) : undefined;
    const floor = registered?.requiresFloor ? report.floor?.trim() : registered?.floorLabel?.trim();
    const room = category === "거주공간" && !report.space?.masked ? report.room?.trim() : undefined;
    const dong = report.space?.dong?.trim();
    const name = registered ? [floor, registered.name].filter(Boolean).join(" ")
      : room ? [dong ? (dong.endsWith("동") ? dong : `${dong}동`) : "", room.endsWith("호") ? room : `${room}호`].filter(Boolean).join(" ")
      : report.space?.name?.trim() || report.locationDescription?.trim();
    if (!name) continue;
    const key = registered ? `common:${registered.code}:${registered.requiresFloor ? report.floor ?? "" : ""}`
      : category === "공용공간" && report.space?.code ? `common:${report.space.code}` : name.replace(/\s+/g, " ");
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { name, count: 1 });
  }
  const places = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
  if (!places.length) return "장소 정보 없음";
  return places.length === 1 ? places[0].name : `${places[0].name} 외 ${places.length - 1}개 공간`;
}
