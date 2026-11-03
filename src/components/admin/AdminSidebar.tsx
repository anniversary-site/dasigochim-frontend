import BrandMark from "@/components/common/BrandMark";
import type { DepartmentWithCount } from "@/api/admin";
import { Box } from "lucide-react";
import { Link } from "react-router-dom";

interface AdminSidebarProps {
  departments: DepartmentWithCount[];
  selectedId: number | null;
  activeView: "reports" | "map3d";
  adminName: string;
  onSelect: (departmentId: number | null) => void;
  onMapSelect: () => void;
  onLogout: () => void;
}

/** 관리자 사이드바 (Figma 323:5379) — 부서별 미처리 건수 */
export default function AdminSidebar({
  departments,
  selectedId,
  activeView,
  adminName,
  onSelect,
  onMapSelect,
  onLogout,
}: AdminSidebarProps) {
  return (
    <aside className="flex w-[273px] shrink-0 flex-col border-r border-gray-200 bg-gray-10">
      <div className="flex items-center gap-2.5 px-6 pt-6">
        <BrandMark size={32} />
        <span className="text-base font-semibold tracking-[-0.4px] text-neutral-800">다시고침</span>
      </div>

      <div className="px-4 pt-6">
        <Link to="/admin" className="mb-2 flex h-10 items-center rounded-[10px] px-2.5 text-sm font-semibold text-sogang-500 hover:bg-sogang-50">← 주택별 민원분석</Link>
        <button
          type="button"
          onClick={onMapSelect}
          className={`flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 transition ${
            activeView === "map3d" ? "bg-sogang-50" : "hover:bg-neutral-50"
          }`}
        >
          <Box className={`size-[18px] ${activeView === "map3d" ? "text-sogang-500" : "text-neutral-500"}`} />
          <span className={`text-sm tracking-[-0.4px] ${activeView === "map3d" ? "font-semibold text-sogang-500" : "font-medium text-neutral-600"}`}>
            3D 지도
          </span>
        </button>
      </div>

      <p className="px-6 pb-2 pt-5 text-[11px] font-medium tracking-[-0.4px] text-neutral-400">
        부서별 미처리
      </p>

      <nav className="min-h-0 flex-1 overflow-y-auto px-4">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex h-10 w-full items-center justify-between rounded-[10px] px-2.5 transition ${
            activeView === "reports" && selectedId === null ? "bg-sogang-50" : "hover:bg-neutral-50"
          }`}
        >
          <span
            className={`text-sm tracking-[-0.4px] ${
              activeView === "reports" && selectedId === null ? "font-semibold text-sogang-500" : "font-medium text-neutral-600"
            }`}
          >
            전체
          </span>
        </button>

        {departments.map((department) => {
          const selected = activeView === "reports" && selectedId === department.id;
          return (
            <button
              key={department.id}
              type="button"
              onClick={() => onSelect(department.id)}
              className={`flex h-10 w-full items-center justify-between rounded-[10px] px-2.5 transition ${
                selected ? "bg-sogang-50" : "hover:bg-neutral-50"
              }`}
            >
              <span
                className={`truncate text-sm tracking-[-0.4px] ${
                  selected ? "font-semibold text-sogang-500" : "font-medium text-neutral-600"
                }`}
              >
                {department.name}
              </span>
              <span
                className={`flex h-5 min-w-[34px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-[-0.4px] ${
                  selected ? "bg-sogang-500 text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {department.pendingCount}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mx-4 mb-6 flex items-center gap-3 border-t border-gray-200 pt-4">
        <span className="size-8 shrink-0 rounded-[6px] bg-neutral-100" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold tracking-[-0.4px] text-neutral-800">{adminName}</p>
          <button
            type="button"
            onClick={onLogout}
            className="text-[11px] font-medium tracking-[-0.4px] text-neutral-400 underline underline-offset-2"
          >
            로그아웃
          </button>
        </div>
      </div>
    </aside>
  );
}
