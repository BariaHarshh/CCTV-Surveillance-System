import React, { useEffect, useRef, useState, useCallback } from "react";
import { Maximize2, VideoOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DetectionOverlay } from "./DetectionOverlay";

interface OverlayDetection {
  label: string;
  confidence?: number | null;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

interface OverlayZone {
  name: string;
  polygon: { x: number; y: number }[];
}

interface StreamInfo {
  available: boolean;
  type: string;
  url?: string | null;
  message?: string;
}

const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000];
const MAX_RETRIES = RETRY_DELAYS_MS.length;

export const CameraStreamView = React.memo(function CameraStreamView({
  cameraDbId,
  status,
  className,
  showFullscreen = true,
  detections = [],
  zones = [],
}: {
  cameraDbId: string;
  status: string;
  className?: string;
  showFullscreen?: boolean;
  detections?: OverlayDetection[];
  zones?: OverlayZone[];
}) {
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [retryExhausted, setRetryExhausted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<StreamInfo | null>(null);
  streamRef.current = stream;
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function initializeStream() {
      if (status !== "ONLINE") {
        if (isCurrent) {
          setStream(null);
          setLoading(false);
        }
        return;
      }

      if (!streamRef.current?.url) {
        setLoading(true);
      }
      setError("");
      setRetryExhausted(false);

      try {
        const res = await fetch(`/api/monitoring/cameras/${cameraDbId}/stream`, { credentials: "include" });
        const data = await res.json();
        if (!isCurrent) return;
        if (data.error) throw new Error(data.error);
        const streamData = data.stream ?? data;
        setStream(streamData);
        retryCountRef.current = 0;
      } catch (e) {
        if (isCurrent) {
          setError(e instanceof Error ? e.message : "Stream unavailable");
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }

    initializeStream();

    return () => {
      isCurrent = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [cameraDbId, status]);

  const handleImageError = () => {
    if (retryCountRef.current < MAX_RETRIES) {
      const delay = RETRY_DELAYS_MS[retryCountRef.current];
      retryCountRef.current += 1;

      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        setRetryKey((k) => k + 1);
      }, delay);
    } else {
      setRetryExhausted(true);
      setError("Stream connection lost. Maximum reconnect attempts reached.");
    }
  };

  const handleImageLoad = () => {
    retryCountRef.current = 0;
    setRetryExhausted(false);
    setError("");
  };

  const handleManualRetry = () => {
    retryCountRef.current = 0;
    setRetryExhausted(false);
    setRetryKey((k) => k + 1);
    fetch(`/api/monitoring/cameras/${cameraDbId}/stream`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStream(data.stream ?? data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Stream unavailable"));
  };

  const offline = status !== "ONLINE";

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden rounded-xl border border-border bg-black/60", className)}>
      {offline ? (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 text-center">
          <VideoOff className="h-10 w-10 text-slate-500" />
          <p className="text-sm font-semibold tracking-wider text-slate-400">CAMERA OFFLINE</p>
        </div>
      ) : loading && !stream?.url ? (
        <div className="flex aspect-video items-center justify-center">
          <p className="text-sm text-muted">Connecting stream...</p>
        </div>
      ) : retryExhausted ? (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 px-4 text-center">
          <VideoOff className="h-8 w-8 text-amber-500" />
          <p className="text-xs font-semibold text-amber-400">Stream Connection Offline</p>
          <p className="text-[11px] text-muted">{error || "Failed to establish direct video connection."}</p>
          <button
            type="button"
            onClick={handleManualRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground hover:bg-glass"
          >
            <RefreshCw className="h-3 w-3" /> Retry Stream
          </button>
        </div>
      ) : stream?.available && stream.url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={retryKey}
            src={stream.url}
            alt="Live camera feed"
            className="aspect-video w-full object-cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
          <DetectionOverlay detections={detections} zones={zones} />
          {showFullscreen && (
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg bg-black/50 p-2 text-white hover:bg-black/70"
              onClick={() => containerRef.current?.requestFullscreen?.()}
              aria-label="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 px-4 text-center">
          <VideoOff className="h-8 w-8 text-slate-500" />
          <p className="text-xs font-medium text-slate-400">Stream unavailable</p>
          <p className="text-[11px] text-muted">{error || stream?.message || "No browser-compatible stream for this camera."}</p>
        </div>
      )}
    </div>
  );
});
