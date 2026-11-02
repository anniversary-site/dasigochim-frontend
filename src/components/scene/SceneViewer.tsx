import { useEffect, useRef, useState } from "react";
import type { ScenePin } from "@/types";

interface SceneViewerProps {
  /** public/scenes/{sceneId}_3d.html */
  sceneId: string;
  /** pick: 탭해서 핀을 꽂는다 / view: 저장된 핀을 보여주기만 한다 */
  mode: "pick" | "view";
  pin?: ScenePin | null;
  onPin?: (pin: ScenePin) => void;
  className?: string;
}

type SceneMessage =
  | { source: "dasigochim-scene"; type: "ready" }
  | { source: "dasigochim-scene"; type: "pin"; pin: ScenePin };

/**
 * 청년주택 3D 장면을 iframe 으로 띄운다. 장면 파일 끝의 연동 스크립트와 postMessage 로 이야기한다.
 * 장면이 준비되면(ready) 현재 핀을 보내고, pick 모드에서 탭하면 새 핀 좌표를 받는다.
 */
export default function SceneViewer({ sceneId, mode, pin, onPin, className }: SceneViewerProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  // 준비를 마친 장면 id. 장면이 바뀌면 자연히 다시 준비 전 상태가 된다.
  const [readyScene, setReadyScene] = useState<string | null>(null);
  const ready = readyScene === sceneId;
  const onPinRef = useRef(onPin);

  useEffect(() => {
    onPinRef.current = onPin;
  }, [onPin]);

  useEffect(() => {
    const handle = (event: MessageEvent<SceneMessage>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "dasigochim-scene") return;
      if (data.type === "ready") setReadyScene(sceneId);
      if (data.type === "pin") onPinRef.current?.(data.pin);
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
