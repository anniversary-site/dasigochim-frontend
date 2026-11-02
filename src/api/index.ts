// 다시고침 API 클라이언트 — 현재 Spring Boot 응답 계약 기준
// 로컬 개발은 Vite의 /api, /files 프록시를 통해 localhost:8080에 연결합니다.

export * from "./http";
export { authApi } from "./auth";
export type { AuthResult, AdminAuthResult } from "./auth";
export { reportApi } from "./reports";
export type { LocationPatch } from "./reports";
export { aiApi } from "./ai";
export type {
  TextDraft,
  ReportQuestion,
  ReportQuestionStep,
  ReportFlowAnswer,
  ReportFlowDraft,
} from "./ai";
export { meApi } from "./me";
export { buildingApi } from "./buildings";
export { adminApi } from "./admin";
export type {
  AdminStatsSummary,
  DepartmentWithCount,
  AdminReportQuery,
} from "./admin";
