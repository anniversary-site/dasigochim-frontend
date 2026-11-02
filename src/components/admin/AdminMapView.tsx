/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { adminApi } from "@/api/admin";
import type { Report, RiskLevel } from "@/types";

declare global {
  interface Window {
    kakao: any;
  }
}

const SOGANG_CENTER = { lat: 37.551, lng: 126.9408 };
const PAGE_SIZE = 100;

interface AdminMapViewProps {
  onSelectReport: (reportId: number) => void;
}

function markerSvg(level: RiskLevel | null): string {
  const color = { LOW: "#E5C946", MEDIUM: "#E8943A", HIGH: "#D94A4A" }[level ?? "MEDIUM"];
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46" fill="none">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 28 18 28s18-15.4 18-28C36 8.06 27.94 0 18 0z" fill="${color}"/>
      <circle cx="18" cy="18" r="8" fill="white"/>
      <circle cx="18" cy="18" r="4" fill="${color}"/>
    </svg>
  `)}`;
}

/** 관리자 신고 전체를 좌표 기준으로 표시한다. 마커를 누르면 해당 신고 상세로 이동한다. */
export default function AdminMapView({ onSelectReport }: AdminMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(() => {
    const key = import.meta.env.VITE_KAKAO_APP_KEY;
    return !key || key === "your-kakao-javascript-key" ? "지도 키가 없어 지도를 표시할 수 없습니다." : null;
  });

  useEffect(() => {
    let cancelled = false;
    const loadReports = async () => {
      try {
        const first = await adminApi.reports({ sort: "latest", page: 0, size: PAGE_SIZE });
        const rest = await Promise.all(
          Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
            adminApi.reports({ sort: "latest", page: index + 1, size: PAGE_SIZE }),
          ),
        );
        if (!cancelled) setReports([first, ...rest].flatMap((page) => page.content));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "신고 위치를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadReports();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const appKey = import.meta.env.VITE_KAKAO_APP_KEY;
    if (!appKey || appKey === "your-kakao-javascript-key") return;

    const createMap = () => {
      if (!mapRef.current) return;
      const nextMap = new window.kakao.maps.Map(mapRef.current, {
        center: new window.kakao.maps.LatLng(SOGANG_CENTER.lat, SOGANG_CENTER.lng),
        level: 4,
      });
      setMap(nextMap);
      setTimeout(() => nextMap.relayout(), 0);
    };

    if (window.kakao?.maps) {
      window.kakao.maps.load(createMap);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-dasigochim-kakao-map="true"]');
    if (existing) {
      existing.addEventListener("load", () => window.kakao.maps.load(createMap), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.dasigochimKakaoMap = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(createMap);
    script.onerror = () => setError("지도를 불러오지 못했습니다. 카카오 앱 키와 허용 도메인을 확인하세요.");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!map) return;
    const markers: any[] = [];
    for (const report of reports) {
      if (report.status === "RESOLVED") continue;
      if (report.lat == null || report.lng == null) continue;
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(report.lat, report.lng),
        map,
        image: new window.kakao.maps.MarkerImage(markerSvg(report.riskLevel), new window.kakao.maps.Size(36, 46), {
          offset: new window.kakao.maps.Point(18, 46),
        }),
        title: report.locationDescription ?? report.building?.name ?? "안전 신고",
      });
      window.kakao.maps.event.addListener(marker, "click", () => onSelectReport(report.id));
      markers.push(marker);
    }
    return () => markers.forEach((marker) => marker.setMap(null));
  }, [map, onSelectReport, reports]);

  const locatedCount = reports.filter(
    (report) => report.status !== "RESOLVED" && report.lat != null && report.lng != null,
  ).length;

  return (
    <section className="relative mt-5 min-h-[620px] flex-1 overflow-hidden rounded-[10px] bg-bg-tertiary shadow-[0px_2px_10px_0px_rgba(0,0,0,0.05)]">
      <div ref={mapRef} className="absolute inset-0" />
      {(loading || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-tertiary/90 px-8 text-center text-sm text-neutral-500">
          {error ?? "신고 위치를 불러오는 중..."}
        </div>
      )}
      {!loading && !error && (
        <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 shadow-[0px_2px_10px_0px_rgba(0,0,0,0.12)]">
          <MapPin className="size-4 text-sogang-500" />
          좌표가 등록된 신고 {locatedCount}건
        </div>
      )}
    </section>
  );
}
