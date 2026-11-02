import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import logo from "@/assets/logo.png";
import GoogleLoginButton from "@/components/login/GoogleLoginButton";
import GuestLoginPanel from "@/components/login/GuestLoginPanel";
import type { PrincipalType } from "@/api/http";
import { GOOGLE_CLIENT_ID, GUEST_LOGIN_ENABLED } from "@/constants/google";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, guestLogin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 로그인 성공 시 입주민은 메인 화면, 관리자는 대시보드로 이동
  const runLogin = useCallback(
    async (request: () => Promise<PrincipalType>) => {
      setSubmitting(true);
      setError(null);
      try {
        const principalType = await request();
        navigate(principalType === "ADMIN" ? "/admin" : "/home", { replace: true });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "로그인에 실패했습니다.");
        setSubmitting(false);
      }
    },
    [navigate]
  );

  // 구글 ID token으로 백엔드 로그인
  const handleCredential = useCallback((idToken: string) => runLogin(() => login(idToken)), [login, runLogin]);

  const handleGuestLogin = useCallback(
    (role: PrincipalType, code: string) => runLogin(() => guestLogin(role, code)),
    [guestLogin, runLogin]
  );

  return (
    <div className="app-shell flex flex-col min-h-dvh px-page">
      {/* Logo Area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <img src={logo} alt="다시고침" className="w-[160px] h-[160px] rounded-xl mb-4" />
        <h1 className="text-2xl font-bold text-text-primary">다시고침</h1>
        <p className="mt-2 text-base text-text-secondary">
          로그인하고 우리 집·공용공간 민원을 신고하세요
        </p>
      </div>

      {/* Login Buttons */}
      <div className="flex flex-col items-center gap-3 pb-12">
        {GOOGLE_CLIENT_ID ? (
          <GoogleLoginButton onCredential={handleCredential} disabled={submitting} />
        ) : (
          <p className="text-sm text-sogang-500 text-center">
            VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다.
          </p>
        )}
        {GUEST_LOGIN_ENABLED && <GuestLoginPanel onGuestLogin={handleGuestLogin} disabled={submitting} />}
        {submitting && <p className="text-sm text-text-secondary text-center">로그인 확인 중...</p>}
        {error && <p className="text-sm text-sogang-500 text-center">{error}</p>}
      </div>
    </div>
  );
}
