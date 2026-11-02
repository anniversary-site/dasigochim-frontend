import { http } from "./http";
import type { Report, User, AppNotification } from "@/types";

export interface ProfileUpdateRequest {
  name: string;
  phone: string;
  buildingId: number;
  dong?: string;
  ho: string;
}

export const meApi = {
  getProfile: () => http.get<User>("/me/profile"),

  updateProfile: (body: ProfileUpdateRequest) => http.patch<User>("/me/profile", body),

  getReports: () => http.get<Report[]>("/me/reports"),

  getNotifications: () => http.get<AppNotification[]>("/me/notifications"),

  readNotification: (id: number) =>
    http.patch<null>(`/me/notifications/${id}/read`),
};
