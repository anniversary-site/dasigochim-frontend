import { Fragment, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import type { Report } from "@/types";
import { REPORT_STATUS_LABEL } from "@/types";
import BrandMark from "@/components/common/BrandMark";
import { reportCategory } from "@/utils/spaceCategorySummary";

const SUGGESTIONS = ["가장 많은 민원", "주요 불편 이유", "미처리 민원", "엑셀로 정리"];

function topCounts(values: (string | null | undefined)[], limit = 3) {
  const counts = new Map<string, number>();
  values.forEach((v) => { const key = v?.trim(); if (key) counts.set(key, (counts.get(key) ?? 0) + 1); });
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const list = (items: [string, number][]) => items.map(([label, n]) => `${label} ${n}건`).join(", ");

/**
 * 민원 분석 챗봇 — 지역 · 청년주택 · 공간 유형 · 상세 공간 어느 범위든 넘겨받은 민원만 보고 답한다.
 * 지금은 등록된 민원을 집계한 기본 요약이다. AI 서버 연동은 아직 없다.
 */
export default function ComplaintChatPanel({ scopeLabel, reports, onClose }: {
  /** 예: "서울시 전체", "서울특별시 마포구", "공덕역 청년안심주택 · 거주공간" */
  scopeLabel: string;
  reports: Report[];
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ question: string; answer: string }[]>([]);

  const resolved = reports.filter((r) => r.status === "RESOLVED").length;
  const open = reports.length - resolved;
  const multiBuilding = new Set(reports.map((r) => r.building?.id).filter(Boolean)).size > 1;

  const exportCsv = () => {
    const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    const rows = [["번호", "청년주택", "민원", "공간", "위험도", "상태", "접수일"],
      ...reports.map((r) => [String(r.id), r.building?.name ?? "", r.summary ?? "", r.locationDescription ?? "",
        r.riskLevel ?? "", REPORT_STATUS_LABEL[r.status], (r.submittedAt ?? r.createdAt).slice(0, 10)])];
    const csv = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scopeLabel.replace(/[\\/:*?"<>|·\s]+/g, "-")}-민원.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const answerFor = (text: string) => {
    if (!reports.length) return `${scopeLabel}에는 아직 접수된 민원이 없어요.`;
    if (text.includes("엑셀") || text.includes("csv") || text.includes("CSV")) {
      exportCsv();
      return `${scopeLabel} 민원 ${reports.length}건을 CSV 파일로 내려받았어요. 엑셀에서 열 수 있어요.`;
    }
    const problems = topCounts(reports.map((r) => r.summary));
    const buildingsTop = topCounts(reports.map((r) => r.building?.name));
    if (text.includes("미처리") || text.includes("처리")) {
      const pending = reports.filter((r) => r.status !== "RESOLVED");
      const high = pending.filter((r) => r.riskLevel === "HIGH").length;
      return pending.length
        ? `아직 처리되지 않은 민원은 ${pending.length}건이에요 (위험도 높음 ${high}건). 많이 남은 유형은 ${list(topCounts(pending.map((r) => r.summary)))}이에요.`
          + (multiBuilding ? `\n미처리가 많은 주택: ${list(topCounts(pending.map((r) => r.building?.name)))}.` : "")
        : "미처리 민원이 없어요. 모두 처리완료됐어요.";
    }
    if (text.includes("이유") || text.includes("불편") || text.includes("유형")) {
      const categories = topCounts(reports.map((r) => reportCategory(r, []) ?? "기타"), 3);
      // 세대 민원은 "세대 내부" 대신 집 안 어느 방인지(핀 라벨)로 센다.
      const places = topCounts(reports.map((r) => r.space?.type === "UNIT"
        ? `세대 ${r.space.pin?.label ?? "내부"}`
        : r.space?.name ?? (r.indoor === false ? "주변공간" : null)));
      return `공간 유형별로는 ${list(categories)}이에요. 불편이 몰리는 곳은 ${list(places)}이고, 자주 나오는 문제는 ${list(problems)}이에요.`;
    }
    const base = `${scopeLabel}에는 민원 ${reports.length}건이 있어요. 가장 많은 민원은 ${list(problems)}이에요. 처리완료 ${resolved}건, 미처리 ${open}건이에요.`;
    return multiBuilding ? `${base}\n민원이 많은 주택: ${list(buildingsTop)}.` : base;
  };

  const ask = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { question: text, answer: answerFor(text) }]);
    setQuestion("");
  };

  return <>
    <div className="chat-heading"><div><b>민원 분석 AI</b><small className="chat-scope">{scopeLabel}</small></div>
      <button className="housing-icon-button" aria-label="대화 닫기" onClick={onClose}><X size={19} /></button></div>
    <div className="chat-messages" aria-live="polite">
      <div className="chat-intro"><BrandMark /><div className="chat-bubble"><b>무엇을 도와드릴까요?</b><p>{scopeLabel}의 민원 {reports.length}건을 바탕으로 답변해 드려요.</p></div></div>
      <div className="chat-suggestions">{SUGGESTIONS.map((q) => <button key={q} onClick={() => ask(q)}>{q}</button>)}</div>
      {messages.map((m, i) => <Fragment key={i}><div className="chat-user">{m.question}</div><div className="chat-bubble answer">{m.answer}</div></Fragment>)}
    </div>
    <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
      <div><input aria-label="AI 질문 입력" placeholder={`${scopeLabel} 민원에 대해 질문해 보세요`} value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button disabled={!question.trim()} aria-label="보내기"><ArrowUp size={21} /></button></div>
      <small>현재는 등록된 민원을 집계한 기본 요약을 제공합니다. AI 연동 준비 중.</small>
    </form>
  </>;
}
