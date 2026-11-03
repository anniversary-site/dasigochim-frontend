import { http, tokenStore, type PrincipalType } from "./http";

export interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  principalType: PrincipalType;
}

export type AdminAuthResult = AuthResult;

export const authApi = {
  // 테스트 로그인 — 백엔드 GUEST_LOGIN_ENABLED가 켜져 있고 접근 코드가 맞을 때만 발급
  async guestLogin(role: PrincipalType, code: string): Promise<AuthResult> {
    const res = await http.post<AuthResult>("/auth/guest", { role, code });
    tokenStore.set(res.accessToken, res.refreshToken, res.principalType);
    return res;
  },

  // refresh token으로 access token 재발급
  async refresh(): Promise<AuthResult> {
    const refreshToken = tokenStore.getRefresh();
    const res = await http.post<AuthResult>("/auth/refresh", { refreshToken });
    tokenStore.set(res.accessToken, res.refreshToken, res.principalType);
    return res;
  },

  // 관리자 로그인 (아이디/비밀번호)
  async adminLogin(loginId: string, password: string): Promise<AdminAuthResult> {
    const res = await http.post<AdminAuthResult>("/admin/auth/login", {
      loginId,
      password,
    });
    tokenStore.set(res.accessToken, res.refreshToken, res.principalType);
    return res;
  },

  logout() {
    tokenStore.clear();
  },
};
