import type { Report } from "@/types";

/** 3D 핀 색: 미처리는 위험도 색, 처리완료는 회색 */
export function markerColor(report: Report) {
  if (report.status === "RESOLVED") return "#9e9e9e";
  if (report.riskLevel === "HIGH") return "#e5484d";
  if (report.riskLevel === "LOW") return "#e8b931";
  return "#f2994a";
}
