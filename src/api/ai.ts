import { http } from "./http";
import type { Report } from "@/types";

export interface TextDraft {
  summary: string;
  description: string;
}

export interface ReportQuestion {
  id: string;
  text: string;
  options: string[];
  allowCustom: boolean;
}

/** 확인 질문 한 개. 답변을 보낼 때마다 다음 질문을 받아온다. */
export interface ReportQuestionStep {
  /** 첫 질문에만 채워진다 */
  introduction: string | null;
  question: ReportQuestion;
  questionIndex: number;
  questionCount: number;
  last: boolean;
  axis: string | null;
}

export interface ReportFlowAnswer {
  questionId: string;
  question: string;
  answer: string;
  axis?: string;
}

export interface ReportFlowDraft {
  summary: string;
  hazardContent: string;
  improvementSuggestion: string;
}

export const aiApi = {
  // ③ 사진+위치 → 요약·위험도·담당부서
  analyzeContent: (reportId: number, description: string) =>
    http.post<Report>("/ai/analyze-content", { reportId, description }),

  // ③-a 자연어 → 보고서 초안
  draftFromText: (text: string) =>
    http.post<TextDraft>("/ai/draft-from-text", { text }),

  // 확인 질문을 하나씩 받아온다. 지금까지의 질문·답변을 함께 보내면
  // AI가 그 내용을 반영해 아직 확인되지 않은 것을 묻는다.
  getNextReportQuestion: (
    reportId: number,
    incidentDescription: string,
    answers: ReportFlowAnswer[],
  ) =>
    http.post<ReportQuestionStep>("/ai/report-flow/next-question", {
      reportId,
      incidentDescription,
      answers,
    }),

  createReportDraft: (
    reportId: number,
    locationDescription: string,
    incidentDescription: string,
    answers: ReportFlowAnswer[],
  ) =>
    http.post<ReportFlowDraft>("/ai/report-flow/draft", {
      reportId,
      locationDescription,
      incidentDescription,
      answers,
    }),
};
