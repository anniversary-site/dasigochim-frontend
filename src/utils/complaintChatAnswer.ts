import type { Report } from "@/types";
import { REPORT_STATUS_LABEL } from "@/types";
import { reportCategory } from "@/utils/spaceCategorySummary";
import { parseComplaintMeta } from "@/utils/reportDescription";

/** 범위 안 민원만 보고 만드는 기본 요약 답변. AI 서버 연동 전 임시. */

function topCounts(values: (string | null | undefined)[], limit = 3) {
  const counts = new Map<string, number>();
  values.forEach((v) => { const key = v?.trim(); if (key) counts.set(key, (counts.get(key) ?? 0) + 1); });
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const list = (items: [string, number][]) => items.map(([label, n]) => `${label} ${n}건`).join(", ");

export function isQuestionLike(text: string) {
  return /많은|이유|불편|미처리|처리|엑셀|csv|요약|정리|몇|어디|언제|왜|\?/i.test(text);
}

export function exportComplaintsCsv(scopeLabel: string, reports: Report[]) {
  const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  // 원문 · 공간 유형 · 근본 요구 · 근본 요구 코드 · 표면 요청은 화면에 따로 보여주지 않고 내보내기에만 넣는다.
  // 분석 항목이 없는 민원은 원문에 description 을 그대로 넣고 나머지는 빈칸으로 둔다.
  const rows = [["번호", "청년주택", "민원", "공간", "위험도", "상태", "접수일",
    "원문", "공간 유형", "근본 요구", "근본 요구 코드", "표면 요청"],
    ...reports.map((r) => {
      const meta = parseComplaintMeta(r.description);
      return [String(r.id), r.building?.name ?? "", r.summary ?? "", r.locationDescription ?? "",
        r.riskLevel ?? "", REPORT_STATUS_LABEL[r.status], (r.submittedAt ?? r.createdAt).slice(0, 10),
        meta?.rawText ?? r.description ?? "", meta?.category ?? reportCategory(r, []) ?? "",
        meta?.rootNeed ?? "", meta?.rootNeedCode ?? "", meta?.surfaceRequest ?? ""];
    })];
  const csv = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${scopeLabel.replace(/[\\/:*?"<>|·\s]+/g, "-")}-민원.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function summarizeScope(scopeLabel: string, reports: Report[]) {
  if (!reports.length) return `${scopeLabel}에는 아직 접수된 민원이 없어요.`;
  const resolved = reports.filter((r) => r.status === "RESOLVED").length;
  return `${scopeLabel}의 민원은 ${reports.length}건이에요. 처리완료 ${resolved}건, 미처리 ${reports.length - resolved}건이에요.`;
}

export function answerComplaintQuestion(scopeLabel: string, reports: Report[], text: string) {
  if (!reports.length) return `${scopeLabel}에는 아직 접수된 민원이 없어요. 범위를 바꿔 보세요.`;
  if (/엑셀|csv/i.test(text)) {
    exportComplaintsCsv(scopeLabel, reports);
    return `${scopeLabel} 민원 ${reports.length}건을 CSV 파일로 내려받았어요. 엑셀에서 열 수 있어요.`;
  }
  const multiBuilding = new Set(reports.map((r) => r.building?.id).filter(Boolean)).size > 1;
  const problems = topCounts(reports.map((r) => r.summary));
  if (/미처리|처리/.test(text)) {
    const pending = reports.filter((r) => r.status !== "RESOLVED");
    const high = pending.filter((r) => r.riskLevel === "HIGH").length;
    return pending.length
      ? `아직 처리되지 않은 민원은 ${pending.length}건이에요 (위험도 높음 ${high}건). 많이 남은 유형은 ${list(topCounts(pending.map((r) => r.summary)))}이에요.`
        + (multiBuilding ? `\n미처리가 많은 주택: ${list(topCounts(pending.map((r) => r.building?.name)))}.` : "")
      : "미처리 민원이 없어요. 모두 처리완료됐어요.";
  }
  if (/이유|불편|유형|어디/.test(text)) {
    const categories = topCounts(reports.map((r) => reportCategory(r, []) ?? "기타"), 3);
    // 세대 민원은 "세대 내부" 대신 집 안 어느 방인지(핀 라벨)로 센다.
    const places = topCounts(reports.map((r) => r.space?.type === "UNIT"
      ? `세대 ${r.space.pin?.label ?? "내부"}`
      : r.space?.name ?? (r.indoor === false ? "주변공간" : null)));
    return `공간 유형별로는 ${list(categories)}이에요. 불편이 몰리는 곳은 ${list(places)}이고, 자주 나오는 문제는 ${list(problems)}이에요.`;
  }
  const resolved = reports.filter((r) => r.status === "RESOLVED").length;
  const base = `${scopeLabel}에는 민원 ${reports.length}건이 있어요. 가장 많은 민원은 ${list(problems)}이에요. 처리완료 ${resolved}건, 미처리 ${reports.length - resolved}건이에요.`;
  return multiBuilding ? `${base}\n민원이 많은 주택: ${list(topCounts(reports.map((r) => r.building?.name)))}.` : base;
}
