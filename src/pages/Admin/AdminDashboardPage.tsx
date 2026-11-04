import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, X } from "lucide-react";
import { adminApi, type AdminStatsSummary, type DepartmentWithCount } from "@/api/admin";
import type { Page } from "@/api/http";
import type { Report, ReportStatus } from "@/types";
import { FILTER_STATUSES, STATUS_LABEL } from "@/constants/adminStatus";
import { useAuth } from "@/auth";
import { useNotifications } from "@/hooks/useNotifications";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopNav from "@/components/admin/AdminTopNav";
import AdminSpaceMapView from "@/components/admin/AdminSpaceMapView";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminRiskCell from "@/components/admin/AdminRiskCell";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import NotificationItem from "@/components/notification/NotificationItem";

const PAGE_SIZE = 20;

function formatDateTime(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 관리자 대시보드 (Figma 323:5377) */
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [summary, setSummary] = useState<AdminStatsSummary | null>(null);
  const [departments, setDepartments] = useState<DepartmentWithCount[]>([]);
  const [adminName, setAdminName] = useState("관리자");
  const [page, setPage] = useState<Page<Report> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [view, setView] = useState<"reports" | "map3d">("reports");
  const {
    notifications,
    loading: notificationsLoading,
    error: notificationsError,
    hasUnread,
    markRead,
  } = useNotifications(true, "admin");

  // 요약·부서는 화면 진입 시 한 번만
  useEffect(() => {
    let cancelled = false;
    void Promise.all([adminApi.me(), adminApi.statsSummary(), adminApi.departments()])
      .then(([admin, stats, depts]) => {
        if (cancelled) return;
        setAdminName(admin.name);
        setSummary(stats);
        setDepartments(depts);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "집계를 불러오지 못했습니다.");
      });
    return () => { cancelled = true; };
  }, []);

  // 목록은 필터가 바뀔 때마다
  useEffect(() => {
    let cancelled = false;
    void adminApi
      .reports({
        status: status ?? undefined,
        departmentId: departmentId ?? undefined,
        q: query || undefined,
        sort: "latest",
        page: pageIndex,
        size: PAGE_SIZE,
      })
      .then((result) => {
        if (cancelled) return;
        setPage(result);
        setError(null);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "신고 목록을 불러오지 못했습니다.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status, departmentId, query, pageIndex]);

  const changeFilter = useCallback((next: () => void) => {
    setView("reports");
    setLoading(true);
    setPageIndex(0);
    next();
  }, []);

  const reports = page?.content ?? [];
  const totalPages = page?.totalPages ?? 0;

  return (
    <div className="flex min-h-dvh flex-col bg-sogang-10">
    <AdminTopNav active="reports" />
    <div className="flex min-h-0 flex-1">
      <AdminSidebar
        departments={departments}
        selectedId={departmentId}
        activeView={view}
        adminName={adminName}
        onSelect={(id) => changeFilter(() => setDepartmentId(id))}
        onMapSelect={() => setView("map3d")}
        onLogout={logout}
      />

      <main className="flex min-w-0 flex-1 flex-col px-9 py-8">
        <div className="relative flex items-center justify-between">
          <h1 className="text-[17px] font-bold tracking-[-0.4px] text-neutral-800">{view === "map3d" ? "3D 지도" : "신고 목록"}</h1>
          <button
            type="button"
            aria-label={notificationsOpen ? "알림 닫기" : "알림"}
            onClick={() => setNotificationsOpen((prev) => !prev)}
            className="relative flex size-9 items-center justify-center rounded-full transition hover:bg-neutral-100"
          >
            {notificationsOpen ? (
              <X className="size-5 text-neutral-800" />
            ) : (
              <span className="relative block">
                <Bell className="size-5 text-neutral-800" />
                {hasUnread && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-sogang-500 ring-2 ring-sogang-10" />
                )}
              </span>
            )}
          </button>

          {/* 관리자 알림 */}
          <div
            aria-hidden={!notificationsOpen}
            className={`absolute right-0 top-11 z-30 w-[380px] transition-all duration-300 ease-out ${
              notificationsOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
            }`}
          >
            <div className="max-h-[320px] overflow-y-auto rounded-[10px] bg-gray-10 shadow-[0px_4px_20px_0px_rgba(0,0,0,0.15)]">
              {notificationsLoading && <p className="py-10 text-center text-sm text-neutral-500">불러오는 중...</p>}
              {notificationsError && <p className="px-5 py-10 text-center text-sm text-sogang-500">{notificationsError}</p>}
              {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                <p className="py-10 text-center text-sm text-neutral-500">새 알림이 없어요.</p>
              )}
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markRead}
                  className="pr-4"
                />
              ))}
            </div>
          </div>
        </div>

        {view === "map3d" ? (
          <AdminSpaceMapView onOpenReport={(reportId) => navigate(`/admin/reports/${reportId}`)} />
        ) : (
        <>
            {/* 요약 */}
            <div className="mt-5 flex gap-5">
              <AdminStatCard label="접수완료" value={summary?.received ?? "-"} />
              <AdminStatCard label="검토중" value={summary?.reviewing ?? "-"} />
              <AdminStatCard label="처리완료" value={summary?.resolved ?? "-"} />
              <AdminStatCard label="오늘 신규" value={summary?.todayNew ?? "-"} accent />
            </div>

            {/* 필터 */}
            <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => changeFilter(() => setStatus(null))}
              className={`h-8 rounded-full px-3.5 text-sm font-medium tracking-[-0.4px] transition ${
                status === null
                  ? "bg-sogang-500 text-white"
                  : "border border-gray-400 bg-gray-10 text-neutral-500 hover:bg-neutral-50"
              }`}
            >
              전체
            </button>
            {FILTER_STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeFilter(() => setStatus(value))}
                className={`h-8 rounded-full px-3.5 text-sm font-medium tracking-[-0.4px] transition ${
                  status === value
                    ? "bg-sogang-500 text-white"
                    : "border border-gray-400 bg-gray-10 text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                {STATUS_LABEL[value]}
              </button>
            ))}
          </div>

          <form
            className="flex h-10 w-[280px] items-center gap-2.5 rounded-[10px] border border-gray-400 bg-white px-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              changeFilter(() => setQuery(search.trim()));
            }}
          >
            <Search className="size-[18px] shrink-0 text-neutral-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목·장소 검색"
              className="min-w-0 flex-1 bg-transparent text-sm tracking-[-0.4px] text-neutral-800 outline-none placeholder:text-neutral-300"
            />
          </form>
            </div>

            {/* 목록 */}
            <div className="mt-5 overflow-hidden rounded-[10px] bg-gray-10 shadow-[0px_2px_10px_0px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-[120px_minmax(0,1fr)_150px_120px_160px] border-b border-gray-200 px-6 py-4 text-xs font-medium tracking-[-0.4px] text-neutral-400">
            <span>위험도</span>
            <span>제목</span>
            <span>담당 부서</span>
            <span>상태</span>
            <span>신고일시</span>
          </div>

          {loading && <p className="py-16 text-center text-sm text-neutral-500">불러오는 중...</p>}
          {error && <p className="py-16 text-center text-sm text-sogang-500">{error}</p>}
          {!loading && !error && reports.length === 0 && (
            <p className="py-16 text-center text-sm text-neutral-500">해당 조건의 신고가 없습니다.</p>
          )}

          {!loading &&
            !error &&
            reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => navigate(`/admin/reports/${report.id}`)}
                className="grid w-full grid-cols-[120px_minmax(0,1fr)_150px_120px_160px] items-center border-b border-gray-200 px-6 py-3.5 text-left transition hover:bg-neutral-50"
              >
                <AdminRiskCell level={report.riskLevel ?? "MEDIUM"} />
                <span className="truncate pr-6 text-sm font-medium tracking-[-0.4px] text-neutral-800">
                  {report.locationDescription ?? report.building?.name ?? report.summary ?? "안전 신고"}
                </span>
                <span>
                  <span className="inline-flex h-8 items-center rounded-full bg-neutral-100 px-2.5 text-sm font-medium tracking-[-0.4px] text-neutral-500">
                    {report.department?.name ?? "미배정"}
                  </span>
                </span>
                <span>
                  <AdminStatusBadge status={report.status} />
                </span>
                <span className="text-xs font-medium tracking-[-0.4px] text-neutral-500">
                  {formatDateTime(report.submittedAt ?? report.createdAt)}
                </span>
              </button>
            ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-4">
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => { setLoading(true); setPageIndex((p) => p - 1); }}
                className="px-2 text-xs text-neutral-300 disabled:opacity-40"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => { setLoading(true); setPageIndex(index); }}
                  className={`h-7 min-w-[28px] rounded-[6px] text-xs tracking-[-0.4px] transition ${
                    index === pageIndex
                      ? "bg-sogang-500 font-semibold text-white"
                      : "font-medium text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => { setLoading(true); setPageIndex((p) => p + 1); }}
                className="px-2 text-xs text-neutral-600 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          )}
            </div>
        </>
        )}
      </main>
    </div>
    </div>
  );
}
