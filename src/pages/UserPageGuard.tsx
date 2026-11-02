import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth";

/** 관리자 JWT는 입주민용 화면을 렌더링하지 않고 관리자 대시보드로 보낸다. */
export default function UserPageGuard({ children }: { children: ReactNode }) {
  const { isAuthLoading, principalType } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-500">
        확인 중...
      </div>
    );
  }
  if (principalType === "ADMIN") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
