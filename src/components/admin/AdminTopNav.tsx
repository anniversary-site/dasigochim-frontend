import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { adminApi, type AdminMe } from "@/api/admin";
import { useAuth } from "@/auth";
import BrandMark from "@/components/common/BrandMark";

export type AdminNavTab = "dashboard" | "map" | "reports";

/**
 * 관리자 화면 공통 상단 바 — 대시보드 · 민원 지도 · 신고 관리 · 마이페이지 · 로그아웃.
 * 첫 화면(/admin)은 onTab 으로 탭만 바꾸고, 다른 화면에서는 /admin 으로 이동한다.
 */
export default function AdminTopNav({ active, me: givenMe, onTab, onBrand }: {
  active: AdminNavTab;
  /** 이미 불러온 관리자 정보가 있으면 넘긴다 (없으면 여기서 불러온다) */
  me?: AdminMe | null;
  onTab?: (tab: "dashboard" | "map") => void;
  onBrand?: () => void;
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [fetchedMe, setFetchedMe] = useState<AdminMe | null>(null);
  const [account, setAccount] = useState(false);
  const me = givenMe ?? fetchedMe;

  useEffect(() => {
    if (givenMe !== undefined) return;
    let cancelled = false;
    adminApi.me().then((data) => { if (!cancelled) setFetchedMe(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [givenMe]);

  const goTab = (tab: "dashboard" | "map") => {
    if (onTab) onTab(tab);
    else navigate(tab === "map" ? "/admin?view=map" : "/admin");
  };

  return (
    <header className="housing-header admin-topnav">
      <button className="housing-brand" onClick={() => (onBrand ? onBrand() : navigate("/admin"))}><BrandMark /><span>청년안심주택 민원분석</span></button>
      <nav aria-label="관리자 메뉴">
        {me && <span className="housing-role" title={`${me.name} · ${me.departmentName}`}>{me.roleLabel} · {me.scopeLabel}</span>}
        {([["dashboard", "대시보드"], ["map", "민원 지도"]] as const).map(([id, label]) =>
          <button key={id} type="button" className={`housing-nav-tab ${active === id ? "active" : ""}`} aria-current={active === id ? "page" : undefined} onClick={() => goTab(id)}>{label}</button>)}
        <Link to="/admin/reports" className={`housing-nav-tab ${active === "reports" ? "active" : ""}`} aria-current={active === "reports" ? "page" : undefined}>신고 관리</Link><i />
        <button type="button" onClick={() => setAccount(true)}>마이페이지</button><i />
        <button type="button" onClick={() => { logout(); navigate("/login"); }}>로그아웃</button>
      </nav>
      {account && <div className="housing-modal-backdrop" onClick={() => setAccount(false)}>
        <section className="housing-modal" role="dialog" aria-modal="true" aria-label="마이페이지" onClick={(e) => e.stopPropagation()}>
          <div><h2>마이페이지</h2><button autoFocus aria-label="닫기" onClick={() => setAccount(false)}><X size={20} /></button></div>
          <p>{me ? <>{me.name} · {me.roleLabel}<br />담당 구역: {me.scopeLabel}<br />부서: {me.departmentName}</> : "관리자 계정으로 접속 중입니다."}</p>
          <button className="housing-primary" onClick={() => setAccount(false)}>확인</button>
        </section>
      </div>}
    </header>
  );
}
