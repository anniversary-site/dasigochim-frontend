import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, Plus, X } from "lucide-react";
import ProfileIdentity from "@/components/common/ProfileIdentity";
import FilterChip from "@/components/common/FilterChip";
import MyReportCard from "@/components/report/MyReportCard";
import ReportDetailView from "@/components/report/ReportDetailView";
import NotificationPanel from "@/components/notification/NotificationPanel";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/auth";
import { reportApi } from "@/api";
import type { Report, ReportSpace, RiskLevel, ReportStatus } from "@/types";

type Tab = "mine" | "others" | "community";
type StatusFilter = "ALL" | Exclude<ReportStatus, "RECEIVING">;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "ALL", label: "전체" },
  { id: "RECEIVED", label: "접수완료" },
  { id: "REVIEWING", label: "검토중" },
  { id: "RESOLVED", label: "처리완료" },
];

const TABS: { id: Tab; label: string }[] = [
  { id: "mine", label: "내 신고" },
  { id: "others", label: "다른 신고" },
  { id: "community", label: "커뮤니티" },
];

interface ReportItem {
  id: number;
  title: string;
  description: string;
  departmentName: string;
  status: ReportStatus;
  riskLevel: RiskLevel;
  date: string;
  imageUrl?: string;
  space?: ReportSpace | null;
}

function toItem(report: Report): ReportItem {
  return {
    id: report.id,
    title: report.locationDescription ?? report.building?.name ?? report.summary ?? "공간 민원",
    description: report.description ?? "상세 내용이 없습니다.",
    departmentName: report.department?.name ?? "담당 부서 배정 중",
    status: report.status,
    riskLevel: report.riskLevel ?? "MEDIUM",
    date: new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" })
      .format(new Date(report.submittedAt ?? report.createdAt)),
    imageUrl: report.photos[0]?.url,
    space: report.space,
  };
}

/** 메인 화면 — 내 신고 / 같은 청년주택 다른 입주민의 신고 / 커뮤니티(준비 중) */
export default function HomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, isAuthLoading, user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  // 마지막으로 불러온 탭의 결과. 탭을 바꾸면 결과가 올 때까지 loading 이다.
  const [result, setResult] = useState<{ tab: Tab; reports: ReportItem[]; error: string | null } | null>(null);
  const [mineCount, setMineCount] = useState(0);
  const [selected, setSelected] = useState<ReportItem | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, loading: notificationsLoading, error: notificationsError, hasUnread, markRead } =
    useNotifications(isLoggedIn);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      navigate("/login", { replace: true, state: { from: "/home" } });
      return;
    }
    if (tab === "community") return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await reportApi.feed(tab);
        if (cancelled) return;
        setResult({ tab, reports: data.map(toItem), error: null });
        if (tab === "mine") setMineCount(data.length);
      } catch (cause) {
        if (!cancelled) {
          setResult({ tab, reports: [], error: cause instanceof Error ? cause.message : "신고 목록을 불러오지 못했습니다." });
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isAuthLoading, isLoggedIn, navigate, tab]);

  const loading = tab !== "community" && result?.tab !== tab;
  const tabReports = loading ? [] : result?.reports ?? [];
  const reports = statusFilter === "ALL" ? tabReports : tabReports.filter((r) => r.status === statusFilter);
  const statusCount = (id: StatusFilter) => id === "ALL" ? tabReports.length : tabReports.filter((r) => r.status === id).length;
  const error = loading ? null : result?.error ?? null;

  const handleReportStart = () => {
    if (!user?.profileCompleted) {
      navigate("/profile", { state: { from: "/report" } });
      return;
    }
    navigate("/report");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const residence = user?.building
    ? `${user.building.name}${user.ho ? `\n${user.dong ? `${user.dong}동 ` : ""}${user.ho}호` : ""}`
    : "거주 청년주택 미등록";

  const emptyMessage =
    tab === "mine" ? (
      <>
        아직 신고한 내역이 없어요.
        <br />
        불편하거나 고장 난 곳을 알려주세요.
      </>
    ) : user?.building ? (
      <>
        같은 청년주택 입주민의 신고가 아직 없어요.
      </>
    ) : (
      <>
        프로필에서 거주 청년주택을 등록하면
        <br />
        같은 단지 입주민의 신고를 볼 수 있어요.
      </>
    );

  return (
    <div className="app-shell relative flex h-svh flex-col bg-gray-10">
      <div className="shrink-0 bg-gradient-to-b from-gray-10 to-transparent">
        <div style={{ height: "max(44px, env(safe-area-inset-top))" }} />
        <div className="flex items-center justify-between px-4 pb-2">
          {selected ? (
            <button
              type="button"
              aria-label="뒤로"
              className="flex size-11 items-center justify-center transition active:scale-95"
              onClick={() => setSelected(null)}
            >
              <ChevronLeft className="size-7 text-neutral-800" />
            </button>
          ) : (
            <h1 className="px-1 text-xl font-bold tracking-[-0.5px] text-neutral-800">다시고침</h1>
          )}
          {!selected && (
            <button
              type="button"
              aria-label="알림"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative z-40 flex size-11 items-center justify-center transition active:scale-95"
            >
              {notificationsOpen ? (
                <X className="size-6 text-neutral-800" />
              ) : (
                <span className="relative block">
                  <Bell className="size-6 text-neutral-800" />
                  {hasUnread && (
                    <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-sogang-500 ring-2 ring-gray-10" />
                  )}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {selected ? (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          <ReportDetailView report={selected} showMyBadge={tab === "mine"} />
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-gray-200 px-4 pb-4 pt-3">
            <div className="flex items-center gap-4 px-1">
              <button type="button" className="flex-1 text-left" onClick={() => navigate("/profile", { state: { from: "/home" } })}>
                <ProfileIdentity wrapDetail avatarSize={64} name={user?.name ?? "사용자"} detail={residence} />
              </button>
              <div className="mr-2 flex w-20 shrink-0 flex-col items-center text-neutral-800">
                <span className="text-2xl font-semibold leading-[1.48] tracking-[-0.6px]">{mineCount}</span>
                <span className="text-sm font-medium leading-[1.48] tracking-[-0.35px]">내 신고</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2 px-1">
              {TABS.map((item) => (
                <FilterChip
                  key={item.id}
                  label={item.label}
                  selected={tab === item.id}
                  onClick={() => { setTab(item.id); setStatusFilter("ALL"); }}
                />
              ))}
            </div>
            {tab !== "community" && (
              <div className="mt-3 flex gap-1.5 px-1" role="group" aria-label="처리 상태로 거르기">
                {STATUS_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={statusFilter === item.id}
                    onClick={() => setStatusFilter(item.id)}
                    className={`flex h-8 items-center gap-1 rounded-[8px] px-2.5 text-[13px] font-semibold tracking-[-0.3px] transition ${
                      statusFilter === item.id ? "bg-sogang-50 text-sogang-500" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {item.label}
                    <span className={statusFilter === item.id ? "text-sogang-500" : "text-neutral-400"}>{loading ? "" : statusCount(item.id)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pb-28">
            {tab === "community" ? (
              <p className="py-20 text-center text-base font-medium leading-[1.48] tracking-[-0.4px] text-neutral-500">
                입주민 커뮤니티는 준비 중이에요.
              </p>
            ) : (
              <>
                {loading && <p className="py-20 text-center text-sm text-neutral-500">신고 목록을 불러오는 중...</p>}
                {error && <p className="px-4 py-20 text-center text-sm text-sogang-500">{error}</p>}
                {!loading && !error && reports.length === 0 && (
                  <p className="py-20 text-center text-base font-medium leading-[1.48] tracking-[-0.4px] text-neutral-500">
                    {tabReports.length > 0
                      ? `${STATUS_FILTERS.find((f) => f.id === statusFilter)?.label} 상태인 신고가 없어요.`
                      : emptyMessage}
                  </p>
                )}
                {!loading && reports.map((report) => (
                  <MyReportCard key={report.id} report={report} onClick={() => setSelected(report)} />
                ))}
              </>
            )}

            {!loading && (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-6 text-center text-sm font-medium tracking-[-0.35px] text-neutral-500 underline underline-offset-4 transition active:text-neutral-800"
              >
                로그아웃
              </button>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[max(24px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={handleReportStart}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-sogang-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0px_4px_20px_0px_rgba(37,110,244,0.35)] transition active:scale-95"
            >
              <Plus className="size-5" />
              신고하기
            </button>
          </div>
        </>
      )}
      <NotificationPanel
        open={notificationsOpen}
        notifications={notifications}
        loading={notificationsLoading}
        error={notificationsError}
        onRead={markRead}
      />
    </div>
  );
}
