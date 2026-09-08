"use client";

interface OverlayDetection {
  label: string;
  confidence?: number | null;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

interface OverlayZone {
  name: string;
  polygon: { x: number; y: number }[];
}

export function DetectionOverlay({
  detections = [],
  zones = [],
}: {
  detections?: OverlayDetection[];
  zones?: OverlayZone[];
}) {
  if (detections.length === 0 && zones.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {zones.map((zone, i) => (
        zone.polygon.length >= 3 ? (
          <svg key={i} className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
            <polygon
              points={zone.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="rgba(248,113,113,0.12)"
              stroke="rgba(248,113,113,0.6)"
              strokeWidth="0.005"
            />
            <text x={zone.polygon[0]?.x ?? 0} y={zone.polygon[0]?.y ?? 0} fill="rgba(248,113,113,0.9)" fontSize="0.04">{zone.name}</text>
          </svg>
        ) : null
      ))}
      {detections.map((d, i) => {
        if (!d.boundingBox) return null;
        const { x, y, w, h } = d.boundingBox;
        return (
          <div
            key={i}
            className="absolute border-2 border-emerald-400/80 bg-emerald-400/10"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
          >
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-black">
              {d.label}{d.confidence != null ? ` ${Math.round(d.confidence * 100)}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
