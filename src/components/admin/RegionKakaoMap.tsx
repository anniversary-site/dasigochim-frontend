/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { geocode, hasKakaoKey, loadKakao, type LatLng } from "@/lib/kakaoMap";

export interface RegionMarker {
  key: string;
  label: string;
  count: number;
  /** 좌표를 찾을 주소 또는 지역명 */
  address: string;
}

/**
 * 관리자 첫 화면 지도 — 카카오맵 위에 시·군·구(또는 청년주택) 마커와 민원 건수를 띄운다.
 * 키가 없거나 지도를 못 불러오면 fallback(기존 배치 마커)을 보여준다.
 */
export default function RegionKakaoMap({ area, level, markers, onSelect, fallback, children }: {
  /** 마커가 하나도 안 잡힐 때 가운데로 둘 지역명 */
  area: string;
  /** 그때 쓸 확대 수준 */
  level: number;
  markers: RegionMarker[];
  onSelect: (key: string) => void;
  fallback: ReactNode;
  children?: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [kakao, setKakao] = useState<any>(null);
  const [map, setMap] = useState<any>(null);
  const [error, setError] = useState<string | null>(hasKakaoKey ? null : "no-key");
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; });

  useEffect(() => {
    if (!hasKakaoKey) return;
    let cancelled = false;
    loadKakao()
      .then((k) => {
        if (cancelled || !boxRef.current) return;
        const instance = new k.maps.Map(boxRef.current, { center: new k.maps.LatLng(37.5665, 126.978), level: 9 });
        instance.addControl(new k.maps.ZoomControl(), k.maps.ControlPosition.RIGHT);
        setKakao(k);
        setMap(instance);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "지도를 불러오지 못했어요."); });
    return () => { cancelled = true; };
  }, []);

  // 마커 그리기 — 주소를 좌표로 바꾼 뒤 한꺼번에 띄우고 화면을 맞춘다.
  const markerKey = markers.map((m) => `${m.key}:${m.count}:${m.address}`).join("|");
  useEffect(() => {
    if (!kakao || !map) return;
    let cancelled = false;
    const overlays: any[] = [];
    (async () => {
      const points = await Promise.all(markers.map((m) => geocode(kakao, m.address)));
      if (cancelled) return;
      const bounds = new kakao.maps.LatLngBounds();
      let placed = 0;
      markers.forEach((m, i) => {
        const point = points[i];
        if (!point) return;
        const position = new kakao.maps.LatLng(point.lat, point.lng);
        const el = document.createElement("button");
        el.type = "button";
        el.className = `housing-marker on-map ${m.count > 0 ? "active" : ""}`;
        el.setAttribute("aria-label", `${m.label} 민원 ${m.count}건`);
        el.innerHTML = `<b>${m.count}</b><span></span>`;
        (el.querySelector("span") as HTMLSpanElement).textContent = m.label;
        el.addEventListener("click", () => onSelectRef.current(m.key));
        const overlay = new kakao.maps.CustomOverlay({ position, content: el, yAnchor: 1.25, clickable: true, zIndex: m.count });
        overlay.setMap(map);
        overlays.push(overlay);
        bounds.extend(position);
        placed++;
      });
      map.relayout();
      if (placed >= 2) {
        map.setBounds(bounds, 60, 60, 60, 60);
      } else {
        const center: LatLng | null = placed === 1 ? points.find(Boolean)! : await geocode(kakao, area);
        if (cancelled) return;
        if (center) map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
        map.setLevel(placed === 1 ? 5 : level);
      }
    })();
    return () => { cancelled = true; overlays.forEach((o) => o.setMap(null)); };
    // markerKey 가 markers 내용을 대신한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakao, map, markerKey, area, level]);

  if (error) return <>{fallback}</>;
  return (
    <section className="housing-map" aria-label="지역 지도">
      <div ref={boxRef} className="absolute inset-0" />
      {!map && <span className="map-placeholder">지도를 불러오는 중…</span>}
      {children}
    </section>
  );
}
