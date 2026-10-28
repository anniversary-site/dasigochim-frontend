import { useState } from "react";
import type { PrincipalType } from "@/api/http";

interface GuestLoginPanelProps {
  onGuestLogin: (role: PrincipalType, code: string) => void;
  disabled?: boolean;
}

/** 심사위원 전용 게스트 로그인 — 접근 코드를 입력하고 학생/관리자 체험 중 하나를 고른다 */
export default function GuestLoginPanel({ onGuestLogin, disabled = false }: GuestLoginPanelProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const canSubmit = !disabled && code.trim().length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-text-secondary underline underline-offset-2"
      >
        심사위원 로그인
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-neutral-200 p-4">
      <p className="text-sm font-medium text-text-primary">심사위원 로그인</p>
      <input
        type="password"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="접근 코드"
        autoComplete="off"
        className="h-11 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-sogang-500"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onGuestLogin("USER", code.trim())}
          className="h-11 flex-1 rounded-lg bg-sogang-500 text-sm font-medium text-white disabled:opacity-40"
        >
          학생으로 체험
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onGuestLogin("ADMIN", code.trim())}
          className="h-11 flex-1 rounded-lg border border-sogang-500 text-sm font-medium text-sogang-500 disabled:opacity-40"
        >
          관리자로 체험
        </button>
      </div>
    </div>
  );
}
