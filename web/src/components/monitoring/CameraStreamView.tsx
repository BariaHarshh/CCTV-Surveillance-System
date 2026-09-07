"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { DetectionOverlay } from "./DetectionOverlay";

interface StreamInfo {
  available: boolean;
  type: string;
  url?: string | null;
  message?: string;
}

interface OverlayDetection {
  label: string;
  confidence?: number | null;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

interface OverlayZone {
  name: string;
  polygon: { x: number; y: number }[];
}

export function CameraStreamView({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    if (status !== "ONLINE") {
      setStream(null);
      return;
    }

    setLoading(true);
    setError("");
    fetch(`/api/monitoring/cameras/${cameraDbId}/stream`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!activeRef.current) return;
        if (data.error) throw new Error(data.error);
        setStream(data.stream ?? data);
      })
      .catch((e) => {
        if (activeRef.current) setError(e instanceof Error ? e.message : "Stream unavailable");
      })
      .finally(() => {
        if (activeRef.current) setLoading(false);
      });

    return () => {
      activeRef.current = false;
    };
  }, [cameraDbId, status]);

  const offline = status !== "ONLINE";

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden rounded-xl border border-border bg-black/60", className)}>
      {offline ? (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 text-center">
          <VideoOff className="h-10 w-10 text-slate-500" />
          <p className="text-sm font-semibold tracking-wider text-slate-400">CAMERA OFFLINE</p>
        </div>
      ) : loading ? (
        <div className="flex aspect-video items-center justify-center">
          <p className="text-sm text-muted">Connecting stream...</p>
        </div>
      ) : stream?.available && stream.url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={retryKey}
            src={stream.url}
            alt="Live camera feed"
            className="aspect-video w-full object-cover"
            onError={() => {
              setTimeout(() => {
                if (activeRef.current) setRetryKey((k) => k + 1);
              }, 1000);
            }}
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
}
