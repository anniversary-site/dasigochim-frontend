import { http } from "./http";
import type { Report, ReporterType, SpaceType } from "@/types";

/** room 은 호수다. 세대 내부(UNIT)는 서버가 동·호수로 세대 타입과 3D 장면을 정한다. */
export interface LocationPatch {
  buildingId?: number;
  locationDescription?: string;
  indoor?: boolean;
  floor?: string;
  room?: string;
  spaceType?: SpaceType;
  spaceCode?: string;
  spaceName?: string;
  dong?: string;
  sceneId?: string;
  pinX?: number;
  pinY?: number;
  pinZ?: number;
  pinLabel?: string;
}

// ── 목록 / 공개 조회 ──
export const reportApi = {
  /** mine = 내 신고, others = 같은 청년주택 다른 입주민의 신고 (세대 내부 위치는 가려져 온다) */
  feed: (filter: "mine" | "others") => http.get<Report[]>(`/reports/feed?filter=${filter}`),

  getByTrackingId: (trackingId: string) =>
    http.get<Report>(`/reports/${trackingId}`),

  // ── 신고 플로우 (draft 방식) ──
  createDraft: () => http.post<Report>("/reports/draft"),

  uploadPhotos: (reportId: number, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("photos", file));
    return http.post<Report>(`/reports/${reportId}/photos`, form);
  },

  patchLocation: (reportId: number, body: LocationPatch) =>
    http.patch<Report>(`/reports/${reportId}/location`, body),

  patch: (reportId: number, body: { summary?: string; description?: string; reporterType?: ReporterType }) =>
    http.patch<Report>(`/reports/${reportId}`, body),

  getDuplicates: (reportId: number) =>
    http.get<Report[]>(`/reports/${reportId}/duplicates`),

  generateReportFile: (reportId: number) =>
    http.post<Report>(`/reports/${reportId}/report-file`),

  submit: (reportId: number) => http.post<Report>(`/reports/${reportId}/submit`),

  deleteDraft: (reportId: number) => http.del<null>(`/reports/${reportId}`),
};
