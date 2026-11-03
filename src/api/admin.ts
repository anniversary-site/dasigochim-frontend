import { http } from "./http";
import type { AppNotification, Department, Report, ReportStatus, RiskLevel } from "@/types";
import type { Page } from "./http";

export interface AdminStatsSummary {
  received: number;
  reviewing: number;
  resolved: number;
  todayNew: number;
}

export interface DepartmentWithCount extends Department {
  pendingCount: number;
}

export interface AdminMe {
  name: string;
}

/** 관리자 3D 지도: 단지의 3D 장면 목록과 접수된 신고 전부 */
export interface AdminSpaceMap {
  building: { id: number; name: string; has3d: boolean };
  scenes: { sceneId: string; name: string }[];
  reports: Report[];
}

export interface AdminReportQuery {
  status?: ReportStatus;
  departmentId?: number;
  sort?: "latest";
  q?: string;
  page?: number;
  size?: number;
}

function toQuery(q: AdminReportQuery): string {
  const p = new URLSearchParams();
  if (q.status) p.set("status", q.status);
  if (q.departmentId) p.set("departmentId", String(q.departmentId));
  if (q.sort) p.set("sort", q.sort);
  if (q.q) p.set("q", q.q);
  p.set("page", String(q.page ?? 0));
  p.set("size", String(q.size ?? 20));
  return p.toString();
}

// 관리자 대시보드 (ROLE_ADMIN)
export const adminApi = {
  me: () => http.get<AdminMe>("/admin/me"),

  statsSummary: () => http.get<AdminStatsSummary>("/admin/stats/summary"),

  departments: () => http.get<DepartmentWithCount[]>("/admin/departments"),

  reports: (query: AdminReportQuery = {}) =>
    http.get<Page<Report>>(`/admin/reports?${toQuery(query)}`),

  reportDetail: (id: number) => http.get<Report>(`/admin/reports/${id}`),

  spaceMap: (buildingId: number) => http.get<AdminSpaceMap>(`/admin/buildings/${buildingId}/space-map`),

  reportFile: (id: number) =>
    http.get<{ url: string }>(`/admin/reports/${id}/report-file`),

  generateReportFile: (id: number) =>
    http.post<{ url: string }>(`/admin/reports/${id}/report-file`),

  changeStatus: (id: number, status: ReportStatus) =>
    http.patch<Report>(`/admin/reports/${id}/status`, { status }),

  reassignDepartment: (id: number, departmentId: number) =>
    http.patch<Report>(`/admin/reports/${id}/department`, { departmentId }),

  changeRiskLevel: (id: number, riskLevel: RiskLevel) =>
    http.patch<Report>(`/admin/reports/${id}/risk-level`, { riskLevel }),

  resolve: (id: number, actionNote: string) =>
    http.post<Report>(`/admin/reports/${id}/resolve`, { actionNote }),

  notifications: () => http.get<AppNotification[]>("/admin/notifications"),

  readNotification: (id: number) => http.patch<AppNotification>(`/admin/notifications/${id}/read`),
};
