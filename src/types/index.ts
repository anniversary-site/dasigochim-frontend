export type ReportStatus = "RECEIVING" | "RECEIVED" | "REVIEWING" | "RESOLVED";
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type RiskLevelSource = "AI" | "ADMIN";
export type ReporterType = "ANONYMOUS" | "REAL_NAME";

export interface Department {
  id: number;
  name: string;
  code?: string;
}

/** 청년주택 단지 */
export interface Building {
  id: number;
  name: string;
  code?: string;
  address?: string;
  sido?: string | null;
  sigungu?: string | null;
}

export interface Region {
  sido: string;
  sigungus: string[];
}

/** 단지의 공용공간과 그 공간을 보여줄 3D 장면 */
export interface BuildingSpace {
  code: string;
  name: string;
  floorLabel: string | null;
  sceneId: string;
  /** 여러 층이 한 장면을 쓰는 공간(4~18층 복도)은 층을 따로 받는다 */
  requiresFloor: boolean;
}

/** 동·호수로 찾은 세대 */
export interface BuildingUnit {
  dong: string | null;
  ho: string;
  floor: string;
  unitType: string;
  sceneId: string;
}

export type SpaceType = "UNIT" | "COMMON";

/** 3D 장면 좌표계(미터)의 핀 위치 */
export interface ScenePin {
  x: number;
  y: number;
  z: number;
  label?: string | null;
}

export interface ReportSpace {
  type: SpaceType | null;
  code: string | null;
  name: string | null;
  dong: string | null;
  unitType: string | null;
  sceneId: string | null;
  pin: ScenePin | null;
  /** 다른 입주민의 세대 내부 신고라 동·호수가 가려졌는지 */
  masked: boolean;
}

export interface User {
  id: number;
  name: string;
  phone?: string | null;
  building: Pick<Building, "id" | "name"> | null;
  dong?: string | null;
  ho?: string | null;
  profileCompleted: boolean;
}

export interface ReportPhoto {
  id: number;
  url: string;
  displayOrder: number;
}

export interface ReportActivity {
  type: string;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus | null;
  actionNote: string | null;
  createdAt: string;
}

export interface Report {
  id: number;
  trackingId: string | null;
  summary: string | null;
  description: string | null;
  status: ReportStatus;
  riskLevel: RiskLevel | null;
  riskLevelSource: RiskLevelSource;
  department: Pick<Department, "id" | "name"> | null;
  reporterType: ReporterType;
  reporterName?: string;
  building: Pick<Building, "id" | "name" | "address"> | null;
  locationDescription: string | null;
  indoor: boolean | null;
  floor: string | null;
  room: string | null;
  space?: ReportSpace | null;
  detectedHazards: string | null;
  reportFileUrl: string | null;
  photos: ReportPhoto[];
  timeline: ReportActivity[] | null;
  submittedAt: string | null;
  createdAt: string;
}

export type NotificationType = "SUBMITTED" | "HIGH_RISK" | "STATUS_CHANGED" | "RESOLVED";

export interface AppNotification {
  id: number;
  trackingId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  RECEIVING: "작성중",
  RECEIVED: "접수완료",
  REVIEWING: "검토중",
  RESOLVED: "처리완료",
};
