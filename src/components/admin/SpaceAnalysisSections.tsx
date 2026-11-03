/** Frontend input model for analysis results; the current API does not supply these yet. */
export interface SpaceAnalysisData {
  rootDemands?: { label: string; count: number; householdCount: number; demandType?: string }[];
  timeSlots?: { label: string; count: number }[];
  unclassifiedReportIds?: number[];
}

export default function SpaceAnalysisSections({ analysis, onReview, children }: {
  analysis?: SpaceAnalysisData;
  onReview: (reportIds: number[]) => void;
  children: React.ReactNode;
}) {
  const demands = (analysis?.rootDemands ?? []).filter(d => Number.isFinite(d.count) && d.count >= 0 && Number.isFinite(d.householdCount) && d.householdCount >= 0)
    .slice().sort((a, b) => b.householdCount - a.householdCount);
  const maxDemand = Math.max(0, ...demands.map(d => d.householdCount));
  const times = (analysis?.timeSlots ?? []).filter(t => Number.isFinite(t.count) && t.count >= 0);
  const maxTime = Math.max(0, ...times.map(t => t.count));
  const unclassified = [...new Set(analysis?.unclassifiedReportIds ?? [])];

  return <>
    <section className="analysis-section"><h3>근본 요구 순위 <small>세대 수 기준</small></h3>
      {demands.length ? <div className="problem-list">{demands.map(d => <div key={d.label} className={maxDemand > 0 && d.householdCount === maxDemand ? "is-leading" : ""}>
        <b>{d.label}</b><small>{d.count}건 · {d.householdCount}세대{d.demandType ? ` · ${d.demandType}` : ""}</small>
        <div className="problem-track" role="meter" aria-label={d.label} aria-valuemin={0} aria-valuemax={maxDemand || 1} aria-valuenow={d.householdCount}><span style={{ width: `${maxDemand ? d.householdCount / maxDemand * 100 : 0}%` }} /></div>
      </div>)}</div> : <p className="housing-muted">근본 요구 분류 결과가 아직 제공되지 않았어요.</p>}
    </section>
    <section className="analysis-section"><h3>언제 불편한가 <small>민원 발생 시간</small></h3>
      {times.length ? <div className="time-chart">{times.map(t => <div key={t.label} className={maxTime > 0 && t.count === maxTime ? "is-leading" : ""}>
        <span>{t.count}</span><i role="meter" aria-label={t.label} aria-valuemin={0} aria-valuemax={maxTime || 1} aria-valuenow={t.count} style={{ height: `${maxTime ? t.count / maxTime * 100 : 0}px` }} /><small>{t.label}</small>
      </div>)}</div> : <p className="housing-muted">불편이 발생한 시간대 정보가 아직 제공되지 않았어요.</p>}
    </section>
    {children}
    {unclassified.length > 0 && <div className="analysis-review"><span>코드북 미분류 {unclassified.length}건 검토 필요</span><button className="housing-text-button" onClick={() => onReview(unclassified)}>검토하기 →</button></div>}
  </>;
}
