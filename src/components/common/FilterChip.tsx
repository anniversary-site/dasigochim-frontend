interface FilterChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

/** 바텀시트 필터 칩 (Figma 289:3548 — 선택/기본) */
export default function FilterChip({ label, selected = false, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border bg-white px-3 py-1.5 text-[13px] tracking-[-0.325px] leading-[1.48] transition-colors ${
        selected
          ? "border-neutral-800 font-bold text-neutral-800"
          : "border-gray-400 font-medium text-gray-900"
      }`}
    >
      {label}
    </button>
  );
}
