/** 심사위원 게스트 로그인 UI 노출 여부 — 심사 기간 배포에서만 true로 둔다 */
export const GUEST_LOGIN_ENABLED = import.meta.env.VITE_GUEST_LOGIN_ENABLED === "true";

// Google Identity Services 연동 상수 — 실제 클라이언트 ID는 .env.local에서 주입한다
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const GOOGLE_SCRIPT_ID = "google-identity-services";
export const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/** 구글이 그리는 공식 버튼의 고정 높이(px). 디자인 버튼 높이(44px)와 달라 오버레이를 늘려 맞춘다. */
export const GOOGLE_BUTTON_HEIGHT = 40;
/** renderButton이 허용하는 폭 범위(px) */
export const GOOGLE_BUTTON_MIN_WIDTH = 200;
export const GOOGLE_BUTTON_MAX_WIDTH = 400;
