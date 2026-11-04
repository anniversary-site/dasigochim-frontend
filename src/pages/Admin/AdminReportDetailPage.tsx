import AdminTopNav from "@/components/admin/AdminTopNav";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { adminApi, type DepartmentWithCount } from "@/api/admin";
import { resolveApiAssetUrl } from "@/api/http";
import type { Report, ReportStatus, RiskLevel } from "@/types";
import { CHANGEABLE_STATUSES, STATUS_LABEL, TIMELINE_STEPS } from "@/constants/adminStatus";
import { RISK_LABEL } from "@/constants/risk";
import { splitDescription } from "@/utils/reportDescription";
import SceneViewer from "@/components/scene/SceneViewer";
import RiskBadge from "@/components/common/RiskBadge";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";

const RISK_LEVELS: RiskLevel[] = ["HIGH", "MEDIUM", "LOW"];
const STATUS_ORDER: ReportStatus[] = ["RECEIVING", "RECEIVED", "REVIEWING", "RESOLVED"];

function formatDateTime(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-[-0.4px] text-neutral-400">{label}</p>
      <p className="mt-1.5 truncate text-sm font-medium tracking-[-0.4px] text-neutral-800">{value}</p>
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-[-0.4px] text-neutral-400">{label}</p>
      <p className="mt-1.5 text-sm font-medium leading-[22.4px] tracking-[-0.4px] text-neutral-800">
        {value}
      </p>
    </div>
  );
}

/** 관리자 신고 상세 (Figma 323:5512) */
export default function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);

  const [report, setReport] = useState<Report | null>(null);
  const [departments, setDepartments] = useState<DepartmentWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(reportId)) return;
    let cancelled = false;
    void (async () => {
      try {
        const [detail, depts] = await Promise.all([
          adminApi.reportDetail(reportId),
          adminApi.departments().catch(() => [] as DepartmentWithCount[]),
        ]);
        if (cancelled) return;
        setReport(detail);
        setDepartments(depts);
        setError(null);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "신고를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportId]);

  // 변경 API는 갱신된 신고를 돌려주므로 그대로 반영한다
  const run = useCallback(async (task: () => Promise<Report>) => {
    setSaving(true);
    setError(null);
    try {
      setReport(await task());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, []);

  const downloadReportFile = useCallback(async () => {
    setDownloading(true);
    try {
      const { url } = await adminApi.generateReportFile(reportId);
      window.open(resolveApiAssetUrl(url), "_blank", "noopener");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "신고서를 내려받지 못했습니다.");
    } finally {
      setDownloading(false);
    }
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col bg-sogang-10">
        <AdminTopNav active="reports" />
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">불러오는 중...</div>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="flex min-h-dvh flex-col bg-sogang-10">
        <AdminTopNav active="reports" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-sogang-500">{error ?? "신고를 찾을 수 없습니다."}</p>
          <Link to="/admin/reports" className="text-sm text-neutral-500 underline underline-offset-4">
            신고 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const { hazard, improvement } = splitDescription(report.description ?? "");
  const currentIndex = STATUS_ORDER.indexOf(report.status);
  const resolved = report.status === "RESOLVED";
  const title = report.locationDescription ?? report.building?.name ?? report.summary ?? "공간 민원";
  const space = report.space;

  return (
    <div className="min-h-dvh bg-sogang-10">
    <AdminTopNav active="reports" />
    <div className="px-9 py-8">
      <Link to="/admin/reports" className="inline-flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-[6px] bg-sogang-50">
          <ArrowLeft className="size-4 text-sogang-500" />
        </span>
        <span className="text-sm font-medium tracking-[-0.4px] text-neutral-500">신고 목록으로</span>
      </Link>

      {error && (
        <p className="mt-4 rounded-[10px] bg-white px-4 py-3 text-sm text-sogang-500">{error}</p>
      )}

      <div className="mt-5 flex items-start gap-6">
        {/* 좌측 — 신고 내용 */}
        <section className="min-w-0 flex-1 rounded-[10px] bg-gray-10 p-8 shadow-[0px_2px_5px_0px_rgba(0,0,0,0.05)]">
          <div className="flex gap-8">
            <div className="size-[280px] shrink-0 overflow-hidden rounded-[6px] bg-neutral-100">
              {report.photos[0]?.url ? (
                <img src={resolveApiAssetUrl(report.photos[0].url)} alt="신고 사진" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-[11px] font-medium text-neutral-400">
                  신고 사진
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <RiskBadge level={report.riskLevel ?? "MEDIUM"} />
                <span className="inline-flex h-6 items-center rounded-full bg-sogang-50 px-2.5 text-xs font-semibold tracking-[-0.4px] text-sogang-500">
                  {RISK_LABEL[report.riskLevel ?? "MEDIUM"]}
                </span>
                <AdminStatusBadge status={report.status} />
              </div>

              <h1 className="mt-3 text-[17px] font-bold tracking-[-0.4px] text-neutral-800">{title}</h1>

              <div className="mt-5 flex flex-col gap-4">
                <Section label="신고 위치" value={title} />
                <Section label="안전·보건 유해·위험 내용" value={hazard || "내용 없음"} />
                {improvement && <Section label="개선 제안 사항" value={improvement} />}
              </div>
            </div>
          </div>

          {space?.sceneId && space.pin && (
            <div className="mt-8 border-t border-gray-200 pt-5">
              <p className="text-xs font-medium tracking-[-0.4px] text-neutral-400">
                3D 위치 · {space.type === "UNIT" ? `세대 내부${space.unitType ? ` (${space.unitType} TYPE)` : ""}` : space.name ?? "공용공간"}
                {report.floor ? ` · ${report.floor}${/^\d+$/.test(report.floor) ? "층" : ""}` : ""}
                {report.room ? ` · ${space.dong ? `${space.dong}동 ` : ""}${report.room}호` : ""}
                {space.pin.label ? ` · ${space.pin.label} 부근` : ""}
              </p>
              <SceneViewer sceneId={space.sceneId} mode="view" pin={space.pin} className="mt-3 h-[360px] w-full border border-gray-200" />
            </div>
          )}

          <div className="mt-8 grid grid-cols-4 gap-6 border-t border-gray-200 pt-5">
            <Field label="신고자" value={report.reporterName ?? "-"} />
            <Field label="담당 부서" value={report.department?.name ?? "미배정"} />
            <Field
              label="신고일시"
              value={formatDateTime(report.submittedAt ?? report.createdAt)}
            />
            <Field label="추적 ID" value={report.trackingId ?? "-"} />
          </div>

          <div className="mt-6 border-t border-gray-200 pt-5">
            <p className="text-xs font-medium tracking-[-0.4px] text-neutral-400">처리 이력</p>
            <ol className="mt-4">
              {TIMELINE_STEPS.map((step, index) => {
                const done = currentIndex >= STATUS_ORDER.indexOf(step.status);
                const activity = report.timeline?.find((item) => item.toStatus === step.status);
                const last = index === TIMELINE_STEPS.length - 1;
                return (
                  <li key={step.status} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`mt-1 size-2.5 shrink-0 rounded-full ${
                          done ? "bg-sogang-500" : "border-2 border-gray-400 bg-gray-10"
                        }`}
                      />
                      {!last && <span className="w-0.5 flex-1 bg-neutral-100" />}
                    </div>
                    <div className={last ? "" : "pb-6"}>
                      <p
                        className={`text-sm font-semibold tracking-[-0.4px] ${
                          done ? "text-neutral-800" : "text-neutral-400"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p
                        className={`mt-0.5 text-xs font-medium tracking-[-0.4px] ${
                          done ? "text-neutral-500" : "text-neutral-300"
                        }`}
                      >
                        {activity
                          ? `${formatDateTime(activity.createdAt)}${activity.actionNote ? ` · ${activity.actionNote}` : ""}`
                          : "대기"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* 우측 — 처리 */}
        <aside className="flex w-[320px] shrink-0 flex-col gap-6">
          <div className="rounded-[10px] bg-gray-10 p-6 shadow-[0px_2px_5px_0px_rgba(0,0,0,0.05)]">
            <button
              type="button"
              onClick={downloadReportFile}
              disabled={downloading}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-sogang-500 text-base font-semibold tracking-[-0.4px] text-white shadow-[0px_4px_10px_0px_rgba(37,110,244,0.25)] transition active:brightness-95 disabled:opacity-70"
            >
              {downloading ? (
                <>
                  <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  다운로드 중...
                </>
              ) : (
                <>
                  <Download className="size-5" />
                  HWP 신고서 다운로드
                </>
              )}
            </button>

            <p className="mt-6 text-xs font-medium tracking-[-0.4px] text-neutral-400">담당 부서 재배정</p>
            <select
              value={report.department?.id ?? ""}
              disabled={saving}
              onChange={(e) => void run(() => adminApi.reassignDepartment(reportId, Number(e.target.value)))}
              className="select-chevron mt-2 h-[46px] w-full rounded-[10px] border border-gray-400 bg-white px-3.5 text-sm font-medium tracking-[-0.4px] text-neutral-800 outline-none"
            >
              <option value="" disabled>
                부서 선택
              </option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>

            <p className="mt-6 text-xs font-medium tracking-[-0.4px] text-neutral-400">상태 변경</p>
            <select
              value={report.status}
              disabled={saving || resolved}
              onChange={(e) => void run(() => adminApi.changeStatus(reportId, e.target.value as ReportStatus))}
              className="select-chevron mt-2 h-[46px] w-full rounded-[10px] border border-gray-400 bg-white px-3.5 text-sm font-medium tracking-[-0.4px] text-neutral-800 outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              {CHANGEABLE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABEL[value]}
                </option>
              ))}
              {/* 처리완료는 고를 수 없지만, 이미 완료된 신고는 현재 값이 빈칸으로 보이지 않게 남겨둔다 */}
              {resolved && (
                <option value="RESOLVED" disabled>
                  {STATUS_LABEL.RESOLVED}
                </option>
              )}
            </select>

            <p className="mt-6 text-xs font-medium tracking-[-0.4px] text-neutral-400">위험도 수동 조정</p>
            <div className="mt-2 flex gap-2">
              {RISK_LEVELS.map((level) => {
                const selected = report.riskLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    disabled={saving}
                    onClick={() => void run(() => adminApi.changeRiskLevel(reportId, level))}
                    className={`h-[38px] flex-1 rounded-[10px] text-sm tracking-[-0.4px] transition ${
                      selected
                        ? "border border-sogang-500 bg-sogang-50 font-semibold text-sogang-500"
                        : "border border-gray-400 bg-white font-medium text-neutral-500 hover:bg-neutral-50"
                    }`}
                  >
                    {RISK_LABEL[level]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[10px] bg-gray-10 p-6 shadow-[0px_2px_5px_0px_rgba(0,0,0,0.05)]">
            <p className="text-xs font-medium tracking-[-0.4px] text-neutral-400">조치 완료 처리</p>
            <textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="조치 내용을 입력하세요"
              className="mt-2 h-24 w-full resize-none rounded-[10px] border border-gray-400 bg-white p-3.5 text-sm font-medium tracking-[-0.4px] text-neutral-800 outline-none placeholder:text-neutral-300"
            />
            <button
              type="button"
              disabled={saving || !actionNote.trim() || report.status === "RESOLVED"}
              onClick={() =>
                void run(async () => {
                  const next = await adminApi.resolve(reportId, actionNote.trim());
                  setActionNote("");
                  return next;
                })
              }
              className="mt-3 h-[46px] w-full rounded-[10px] border border-sogang-500 bg-white text-sm font-semibold tracking-[-0.4px] text-sogang-500 transition hover:bg-sogang-50 disabled:opacity-40"
            >
              조치 완료
            </button>
          </div>
        </aside>
      </div>
    </div>
    </div>
  );
}
