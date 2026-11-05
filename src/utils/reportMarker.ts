import type { Report } from "@/types";

/** 3D 핀 색: 위험도 따라 높음 빨강 · 중간 주황 · 낮음 노랑. 처리완료는 같은 색을 반투명하게(markerFaded). */
export function markerColor(report: Report) {
  if (report.riskLevel === "HIGH") return "#e5484d";
  if (report.riskLevel === "LOW") return "#e8b931";
  return "#f2994a";
}

/** 처리완료 신고는 핀을 반투명하게 */
export function markerFaded(report: Report) {
  return report.status === "RESOLVED";
}
