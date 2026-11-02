// ────────────────────────────────────────────────────────────
// HTTP 클라이언트 — specification repo v1.0 계약 기준
//  - 응답 래퍼: { success, data, error:{ code, message } }
//  - 인증: Authorization: Bearer {JWT}
//  - 페이지네이션: { content, totalElements, totalPages, page, size } (page 0-base)
// ────────────────────────────────────────────────────────────

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export class ApiException extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiException";
    this.code = code;
    this.status = status;
  }
}

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

/** 백엔드의 `/files/...` 상대 URL을 API 도메인 기준 URL로 변환한다. */
export function resolveApiAssetUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url) || !/^https?:\/\//i.test(BASE_URL)) return url;
  return new URL(url, BASE_URL).toString();
}

// ── JWT 저장소 (Access/Refresh) ──
const ACCESS_KEY = "dasigochim_access_token";
const REFRESH_KEY = "dasigochim_refresh_token";
const PRINCIPAL_TYPE_KEY = "dasigochim_principal_type";

export type PrincipalType = "USER" | "ADMIN";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  getPrincipalType: (): PrincipalType | null => {
    const value = localStorage.getItem(PRINCIPAL_TYPE_KEY);
    return value === "USER" || value === "ADMIN" ? value : null;
  },
  set(access: string, refresh?: string, principalType?: PrincipalType) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    if (principalType) localStorage.setItem(PRINCIPAL_TYPE_KEY, principalType);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(PRINCIPAL_TYPE_KEY);
  },
};

type Body = object | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
  return requestWithRetry<T>(method, path, body, true);
}

async function requestWithRetry<T>(method: string, path: string, body: Body, retry: boolean): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.getAccess();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && path !== "/auth/refresh" && tokenStore.getRefresh()) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokenStore.getRefresh() }),
      });
      const refreshEnv = (await refreshRes.json()) as Envelope<{
        accessToken: string;
        refreshToken?: string;
        principalType?: PrincipalType;
      }>;
      if (!refreshRes.ok || !refreshEnv.success || !refreshEnv.data) throw new Error();
      tokenStore.set(refreshEnv.data.accessToken, refreshEnv.data.refreshToken, refreshEnv.data.principalType);
      return requestWithRetry<T>(method, path, body, false);
    } catch {
      tokenStore.clear();
      window.dispatchEvent(new Event("dasigochim:unauthorized"));
    }
  }

  let env: Envelope<T> | null = null;
  try {
    env = (await res.json()) as Envelope<T>;
  } catch {
    // 본문 없음(204 등)
  }

  if (!res.ok || !env || env.success === false) {
    const code = env?.error?.code ?? `HTTP_${res.status}`;
    const message =
      env?.error?.message ?? res.statusText ?? "요청에 실패했습니다.";
    throw new ApiException(message, code, res.status);
  }
  return env.data as T;
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: Body) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: Body) => request<T>("PATCH", path, body),
  del: <T>(path: string, body?: Body) => request<T>("DELETE", path, body),
};
