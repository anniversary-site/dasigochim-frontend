import { useState } from "react";
import type { PrincipalType } from "@/api/http";
import type { AdminRole } from "@/api/auth";

interface GuestLoginPanelProps {
  onGuestLogin: (role: PrincipalType, code: string, adminRole?: AdminRole) => void;
  disabled?: boolean;
}

const ADMIN_ROLES: { role: AdminRole; label: string; detail: string }[] = [
  { role: "SUPER", label: "전체 관리자", detail: "전국 모든 청년주택" },
  { role: "REGION", label: "지역 담당자", detail: "서울특별시 마포구" },
  { role: "BUILDING", label: "단지 관리인", detail: "공덕역 청년안심주택 e·seo" },
];

/** 테스트 로그인 — 접근 코드를 입력하고 입주민 또는 관리자(역할 선택) 체험 중 하나를 고른다 */
export default function GuestLoginPanel({ onGuestLogin, disabled = false }: GuestLoginPanelProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pickRole, setPickRole] = useState(false);
  const canSubmit = !disabled && code.trim().length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-text-secondary underline underline-offset-2"
      >
        테스트 로그인
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-neutral-200 p-4">
      <p className="text-sm font-medium text-text-primary">테스트 로그인</p>
      <input
        type="password"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="접근 코드"
        autoComplete="off"
        className="h-11 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-sogang-500"
      />
      {!pickRole ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onGuestLogin("USER", code.trim())}
            className="h-11 flex-1 rounded-lg bg-sogang-500 text-sm font-medium text-white disabled:opacity-40"
          >
            입주민으로 체험
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => setPickRole(true)}
            className="h-11 flex-1 rounded-lg border border-sogang-500 text-sm font-medium text-sogang-500 disabled:opacity-40"
          >
            관리자로 체험
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-secondary">어떤 관리자로 들어갈까요? 역할마다 볼 수 있는 구역이 달라요.</p>
          {ADMIN_ROLES.map((item) => (
            <button
              key={item.role}
              type="button"
              disabled={!canSubmit}
              onClick={() => onGuestLogin("ADMIN", code.trim(), item.role)}
              className="flex h-12 items-center justify-between rounded-lg border border-neutral-200 px-3 text-left transition hover:border-sogang-500 disabled:opacity-40"
            >
              <span className="text-sm font-semibold text-text-primary">{item.label}</span>
              <span className="text-xs text-text-secondary">{item.detail}</span>
            </button>
          ))}
          <button type="button" onClick={() => setPickRole(false)} className="h-9 text-xs text-text-secondary underline">
            뒤로
          </button>
        </div>
      )}
    </div>
  );
}
