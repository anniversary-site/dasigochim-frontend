import { useEffect, useRef, useState } from "react";
import type { ScenePin } from "@/types";

/** 여러 핀을 띄울 때 한 개. id 는 누르면 onPinClick 으로 돌아온다. */
export interface SceneMarker {
  id: number;
  x: number;
  y: number;
  z: number;
  color: string;
  /** 처리완료 등 — 반투명하게 */
  faded?: boolean;
}

interface SceneViewerProps {
  /** public/scenes/{sceneId}_3d.html */
  sceneId: string;
  /** pick: 탭해서 핀을 꽂는다 / view: 저장된 핀을 보여주기만 한다 */
  mode: "pick" | "view";
  pin?: ScenePin | null;
  onPin?: (pin: ScenePin) => void;
  /** 여러 핀 (관리자 3D 지도) */
  markers?: SceneMarker[];
  selectedId?: number | null;
  onMarkerClick?: (id: number) => void;
  className?: string;
}

type SceneMessage =
  | { source: "dasigochim-scene"; type: "ready" }
  | { source: "dasigochim-scene"; type: "pin"; pin: ScenePin }
  | { source: "dasigochim-scene"; type: "pinClick"; id: number };

/**
 * 청년주택 3D 장면을 iframe 으로 띄운다. 장면 파일 끝의 연동 스크립트와 postMessage 로 이야기한다.
 * 장면이 준비되면(ready) 현재 핀을 보내고, pick 모드에서 탭하면 새 핀 좌표를 받는다.
 */
export default function SceneViewer({ sceneId, mode, pin, onPin, markers, selectedId, onMarkerClick, className }: SceneViewerProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  // 준비를 마친 장면 id. 장면이 바뀌면 자연히 다시 준비 전 상태가 된다.
  const [readyScene, setReadyScene] = useState<string | null>(null);
  const ready = readyScene === sceneId;
  const onPinRef = useRef(onPin);
  const onMarkerClickRef = useRef(onMarkerClick);

  useEffect(() => {
    onPinRef.current = onPin;
    onMarkerClickRef.current = onMarkerClick;
  }, [onPin, onMarkerClick]);

  useEffect(() => {
    const handle = (event: MessageEvent<SceneMessage>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "dasigochim-scene") return;
      if (data.type === "ready") setReadyScene(sceneId);
      if (data.type === "pin") onPinRef.current?.(data.pin);
      if (data.type === "pinClick") onMarkerClickRef.current?.(data.id);
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [sceneId]);

  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage(
      pin ? { source: "dasigochim-app", type: "setPin", pin } : { source: "dasigochim-app", type: "clearPin" },
      window.location.origin,
    );
  }, [ready, pin]);

  useEffect(() => {
    if (!ready || !markers) return;
    frameRef.current?.contentWindow?.postMessage(
      { source: "dasigochim-app", type: "setPins", pins: markers, selectedId: selectedId ?? null },
      window.location.origin,
    );
  }, [ready, markers, selectedId]);

  return (
    <div className={`relative overflow-hidden rounded-[12px] bg-white ${className ?? ""}`}>
      <iframe
        ref={frameRef}
        key={sceneId}
        title="3D 공간"
        src={`/scenes/${sceneId}_3d.html?embed=1&mode=${mode}`}
        className="absolute inset-0 h-full w-full border-0"
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white text-sm text-neutral-500">
          <span className="size-3.5 animate-spin rounded-full border-2 border-[#e9e9e9] border-t-sogang-500" />
          3D 공간을 불러오는 중...
        </div>
      )}
    </div>
  );
}
