import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Building, Report } from "@/types";
import { REPORT_STATUS_LABEL } from "@/types";
import { reportCategory } from "@/utils/spaceCategorySummary";

type Period = "month" | "30d" | "90d" | "all";
const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "이번 달" },
  { id: "30d", label: "최근 30일" },
  { id: "90d", label: "최근 3개월" },
  { id: "all", label: "전체" },
];
// 검증한 범주 팔레트 (validate_palette.js 통과): 접수 · 처리완료 / 공용 · 거주 · 주변
const SERIES = { received: "#256ef4", resolved: "#eb6834" };
const CATEGORY_COLORS: Record<string, string> = { 공용공간: "#256ef4", 거주공간: "#eb6834", 주변공간: "#1baf7a" };
const DAY = 86_400_000;

const submitted = (r: Report) => new Date(r.submittedAt ?? r.createdAt).getTime();
const days = (ms: number) => Math.round((ms / DAY) * 10) / 10;

function periodStart(period: Period, now: Date) {
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (period === "30d") return now.getTime() - 30 * DAY;
  if (period === "90d") return now.getTime() - 90 * DAY;
  return 0;
}

/**
 * 관리자 첫 화면 대시보드 — 담당 구역 전체를 한눈에.
 * 신고 목록은 서버가 이미 담당 범위로 걸러 보내므로 여기서는 기간만 건다.
 */
export default function AreaDashboard({ title, reports, buildings }: {
  title: string;
  reports: Report[];
  buildings: Building[];
}) {
  const [period, setPeriod] = useState<Period>("30d");
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const now = useMemo(() => new Date(), []);
  const start = periodStart(period, now);
  const inPeriod = reports.filter((r) => submitted(r) >= start);
  const resolvedInPeriod = inPeriod.filter((r) => r.status === "RESOLVED");
  const open = reports.filter((r) => r.status !== "RESOLVED" && r.status !== "RECEIVING");
  const highOpen = open.filter((r) => r.riskLevel === "HIGH");
  const handled = resolvedInPeriod.filter((r) => r.resolvedAt);
  const avgDays = handled.length
    ? days(handled.reduce((n, r) => n + (new Date(r.resolvedAt!).getTime() - submitted(r)), 0) / handled.length)
    : null;
  const rate = inPeriod.length ? Math.round((resolvedInPeriod.length / inPeriod.length) * 100) : null;
  const delayed = open.filter((r) => now.getTime() - submitted(r) > 7 * DAY).sort((a, b) => submitted(a) - submitted(b));

  // 최근 6개월 접수 · 처리완료 (처리완료는 처리된 달 기준)
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const from = d.getTime();
    return {
      label: `${d.getMonth() + 1}월`,
      received: reports.filter((r) => submitted(r) >= from && submitted(r) < next).length,
      resolved: reports.filter((r) => r.resolvedAt && new Date(r.resolvedAt).getTime() >= from && new Date(r.resolvedAt).getTime() < next).length,
    };
  }), [reports, now]);
  const monthMax = Math.max(1, ...months.flatMap((m) => [m.received, m.resolved]));

  const categories = ["공용공간", "거주공간", "주변공간"].map((c) => ({
    name: c, count: inPeriod.filter((r) => reportCategory(r, []) === c).length,
  }));
  const categoryTotal = categories.reduce((n, c) => n + c.count, 0);

  const problemCounts = new Map<string, number>();
  inPeriod.forEach((r) => { const k = r.summary?.trim(); if (k) problemCounts.set(k, (problemCounts.get(k) ?? 0) + 1); });
  const problems = [...problemCounts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const problemMax = Math.max(1, ...problems.map(([, n]) => n));

  // 순위: 여러 단지면 청년주택별, 한 단지면 공간별
  const multi = new Set(reports.map((r) => r.building?.id).filter(Boolean)).size > 1 || buildings.length > 1;
  const rankingRows = new Map<string, { label: string; total: number; open: number; resolvedMs: number; resolvedN: number }>();
  inPeriod.forEach((r) => {
      const label = multi ? r.building?.name ?? "미등록"
        : r.space?.type === "UNIT" ? `세대 ${r.space.unitType ? `${r.space.unitType} TYPE` : "내부"}` : r.space?.name ?? (r.indoor === false ? "주변공간" : "기타");
      const row = rankingRows.get(label) ?? { label, total: 0, open: 0, resolvedMs: 0, resolvedN: 0 };
      row.total++;
      if (r.status !== "RESOLVED") row.open++;
      if (r.resolvedAt) { row.resolvedMs += new Date(r.resolvedAt).getTime() - submitted(r); row.resolvedN++; }
      rankingRows.set(label, row);
  });
  const ranking = [...rankingRows.values()].sort((a, b) => b.open - a.open || b.total - a.total).slice(0, 8);

  return (
    <section className="area-dashboard" aria-label={`${title} 대시보드`}>
      <div className="dash-head">
        <div><p>담당 구역 현황</p><h2>{title}</h2></div>
        <div className="dash-periods" role="group" aria-label="기간">
          {PERIODS.map((p) => <button key={p.id} type="button" className={`housing-chip ${period === p.id ? "active" : ""}`} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
      </div>

      <div className="dash-kpis">
        <Kpi label="신규 접수" value={inPeriod.length} unit="건" note={PERIODS.find((p) => p.id === period)?.label} />
        <Kpi label="미처리" value={open.length} unit="건" note="접수완료 + 검토중 (현재)" />
        <Kpi label="처리율" value={rate ?? "—"} unit={rate === null ? "" : "%"} note={`처리완료 ${resolvedInPeriod.length}건`} />
        <Kpi label="평균 처리 기간" value={avgDays ?? "—"} unit={avgDays === null ? "" : "일"} note="접수 → 처리완료" />
        <Kpi label="위험 높음 미처리" value={highOpen.length} unit="건" note="즉시 확인 필요" alert={highOpen.length > 0} />
      </div>

      <div className="dash-grid">
        <div className="dash-card dash-wide">
          <div className="dash-card-head"><h3>월별 접수 · 처리 추이</h3>
            <div className="dash-legend"><Swatch color={SERIES.received} label="접수" /><Swatch color={SERIES.resolved} label="처리완료" /></div></div>
          <div className="dash-bars" role="img" aria-label={months.map((m) => `${m.label} 접수 ${m.received}건 처리 ${m.resolved}건`).join(", ")}>
            {months.map((m, i) => (
              <div key={m.label} className="dash-bar-group" onMouseEnter={() => setHoverMonth(i)} onMouseLeave={() => setHoverMonth(null)}>
                {hoverMonth === i && <div className="dash-tip"><b>{m.label}</b><span><Swatch color={SERIES.received} label={`접수 ${m.received}건`} /></span><span><Swatch color={SERIES.resolved} label={`처리완료 ${m.resolved}건`} /></span></div>}
                <div className="dash-bar-pair">
                  <i style={{ height: `${(m.received / monthMax) * 100}%`, background: SERIES.received }} />
                  <i style={{ height: `${(m.resolved / monthMax) * 100}%`, background: SERIES.resolved }} />
                </div>
                <small>{m.label}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><h3>공간 유형별</h3><small>{categoryTotal}건</small></div>
          <div className="dash-stack" role="img" aria-label={categories.map((c) => `${c.name} ${c.count}건`).join(", ")}>
            {categories.filter((c) => c.count).map((c) => <i key={c.name} title={`${c.name} ${c.count}건`} style={{ flexGrow: c.count, background: CATEGORY_COLORS[c.name] }} />)}
          </div>
          <ul className="dash-list">
            {categories.map((c) => <li key={c.name}><Swatch color={CATEGORY_COLORS[c.name]} label={c.name} /><b>{c.count}건</b><small>{categoryTotal ? Math.round((c.count / categoryTotal) * 100) : 0}%</small></li>)}
          </ul>
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><h3>많이 나오는 민원 TOP 5</h3></div>
          {problems.length ? <ul className="dash-hbars">
            {problems.map(([label, n]) => <li key={label}><span>{label}</span><div><i style={{ width: `${(n / problemMax) * 100}%` }} /></div><b>{n}</b></li>)}
          </ul> : <p className="housing-muted">이 기간에 접수된 민원이 없어요.</p>}
        </div>

        <div className="dash-card dash-wide">
          <div className="dash-card-head"><h3>{multi ? "청년주택별 현황" : "공간별 현황"}</h3><small>미처리 많은 순</small></div>
          {ranking.length ? <table className="dash-table">
            <thead><tr><th>{multi ? "청년주택" : "공간"}</th><th>민원</th><th>미처리</th><th>평균 처리</th></tr></thead>
            <tbody>{ranking.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.total}</td><td className={row.open ? "is-open" : ""}>{row.open}</td><td>{row.resolvedN ? `${days(row.resolvedMs / row.resolvedN)}일` : "—"}</td></tr>)}</tbody>
          </table> : <p className="housing-muted">이 기간에 접수된 민원이 없어요.</p>}
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><h3>처리 지연</h3><small>7일 넘게 미처리 {delayed.length}건</small></div>
          {delayed.length ? <ul className="dash-delayed">
            {delayed.slice(0, 5).map((r) => <li key={r.id}><Link to={`/admin/reports/${r.id}`}><span><b>{r.summary ?? "공간 민원"}</b><small>{multi ? `${r.building?.name ?? ""} · ` : ""}{REPORT_STATUS_LABEL[r.status]}</small></span><em>{Math.floor((now.getTime() - submitted(r)) / DAY)}일째</em></Link></li>)}
          </ul> : <p className="housing-muted">지연된 민원이 없어요.</p>}
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value, unit, note, alert }: { label: string; value: number | string; unit: string; note?: string; alert?: boolean }) {
  return <div className={`dash-kpi ${alert ? "is-alert" : ""}`}><span>{label}</span><b>{value}<small>{unit}</small></b>{note && <em>{note}</em>}</div>;
}

function Swatch({ color, label }: { color: string; label: string }) {
  return <span className="dash-swatch"><i style={{ background: color }} />{label}</span>;
}
