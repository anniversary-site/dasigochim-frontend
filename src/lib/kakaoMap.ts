/* eslint-disable @typescript-eslint/no-explicit-any */
/** 카카오맵 JS SDK 를 한 번만 불러오고, 주소 → 좌표 변환 결과를 캐시한다. */

declare global {
  interface Window {
    kakao: any;
  }
}

export type LatLng = { lat: number; lng: number };

const APP_KEY = import.meta.env.VITE_KAKAO_APP_KEY as string | undefined;
export const hasKakaoKey = Boolean(APP_KEY && APP_KEY !== "your-kakao-javascript-key");

let loading: Promise<any> | null = null;

export function loadKakao(): Promise<any> {
  if (!hasKakaoKey) return Promise.reject(new Error("카카오 지도 키(VITE_KAKAO_APP_KEY)가 없어요."));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const done = () => window.kakao.maps.load(() => resolve(window.kakao));
    if (window.kakao?.maps) { done(); return; }
    const script = document.createElement("script");
    script.id = "kakao-sdk";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => (window.kakao?.maps ? done() : reject(new Error("카카오 지도를 불러오지 못했어요.")));
    script.onerror = () => { loading = null; reject(new Error("카카오 지도를 불러오지 못했어요. 키나 등록된 도메인을 확인해 주세요.")); };
    document.head.appendChild(script);
  });
  return loading;
}

const geocodeCache = new Map<string, Promise<LatLng | null>>();

/** 주소(또는 "서울특별시 마포구" 같은 지역명)를 좌표로. 못 찾으면 null */
export function geocode(kakao: any, address: string): Promise<LatLng | null> {
  // "… 2-350 외66", "… 일원", "208-4,9,17" 같은 필지 꼬리는 지오코더가 못 읽는다.
  const query = address
    .replace(/(\s*(외|일원)(\s*\d+\s*(필지)?)?)+$/, "")
    .replace(/,[\d,\s-]*$/, "")
    .trim();
  const cached = geocodeCache.get(query);
  if (cached) return cached;
  const next = search(kakao, query).then((found) => {
    if (found) return found;
    // 지번이 합병·분할돼 안 잡히면 번지를 떼고 동 단위로라도 찍는다.
    const coarse = query.replace(/\s+(산\s*)?\d+(-\d+)?$/, "");
    return coarse !== query ? search(kakao, coarse) : null;
  });
  geocodeCache.set(query, next);
  return next;
}

function search(kakao: any, query: string): Promise<LatLng | null> {
  return new Promise((resolve) => {
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(query, (result: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK && result.length) {
        resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
      } else {
        resolve(null);
      }
    });
  });
}
