"use client";

import { useEffect, useRef } from "react";

type TileStyle = "standard" | "dark" | "satellite";

interface Props {
  center: { lat: number; lng: number };
  tileStyle: TileStyle;
  objects: Record<string, unknown> | null;
  heatmap: Record<string, unknown> | null;
  showCoverage: boolean;
  reducedMotion?: boolean;
  onSelect: (payload: Record<string, unknown>) => void;
  onViewChange: (view: { lat: number; lng: number; zoom: number }) => void;
}

const TILES: Record<TileStyle, { url: string; attr: string; maxZoom?: number }> = {
  standard: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: "&copy; OpenStreetMap",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: "&copy; OpenStreetMap &copy; CARTO",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "Tiles &copy; Esri",
    maxZoom: 19,
  },
};

function markerColor(kind: string, status?: string, severity?: string) {
  if (kind === "INCIDENT" || kind === "incident") {
    if (severity === "CRITICAL") return "#ef4444";
    return "#f59e0b";
  }
  if (kind === "CAMERA" || kind === "camera") {
    if (status === "OFFLINE") return "#64748b";
    if (status === "DEGRADED" || status === "MAINTENANCE") return "#f97316";
    return "#38bdf8";
  }
  if (kind === "RESPONSE_TEAM") return "#a78bfa";
  if (kind === "EXIT") return "#f97316";
  if (kind === "ASSEMBLY_AREA") return "#22d3ee";
  if (kind === "BUILDING") return "#94a3b8";
  if (kind === "ALERT") return "#fb7185";
  return "#e2e8f0";
}

export function CampusMapCanvas({
  center,
  tileStyle,
  objects,
  heatmap,
  showCoverage,
  reducedMotion,
  onSelect,
  onViewChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const onViewRef = useRef(onViewChange);
  onSelectRef.current = onSelect;
  onViewRef.current = onViewChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      // @ts-expect-error css side-effect
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([center.lat, center.lng], 16);

      const tile = TILES[tileStyle];
      L.tileLayer(tile.url, {
        attribution: tile.attr,
        maxZoom: tile.maxZoom ?? 20,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      map.on("moveend", () => {
        const c = map.getCenter();
        onViewRef.current({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
    // init once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map) return;
      const L = await import("leaflet");
      // Swap tiles
      map.eachLayer((layer) => {
        if ((layer as import("leaflet").TileLayer).getAttribution) {
          // keep markers; remove only tile layers by checking _url
          const anyLayer = layer as unknown as { _url?: string };
          if (anyLayer._url) map.removeLayer(layer);
        }
      });
      const tile = TILES[tileStyle];
      L.tileLayer(tile.url, { attribution: tile.attr, maxZoom: tile.maxZoom ?? 20 }).addTo(map);
    })();
  }, [tileStyle]);

  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map || !objects) return;
      const L = await import("leaflet");

      if (layerRef.current) {
        layerRef.current.clearLayers();
      } else {
        layerRef.current = L.layerGroup().addTo(map);
      }
      const group = layerRef.current;

      const addPoints = (arr: unknown, kind: string) => {
        const list = (arr as Array<Record<string, unknown>>) || [];
        for (const item of list) {
          if (item.isCluster) {
            const count = Number(item.count || 0);
            const marker = L.circleMarker([Number(item.lat), Number(item.lng)], {
              radius: Math.min(28, 10 + count),
              color: "#fff",
              weight: 2,
              fillColor: "#ef4444",
              fillOpacity: reducedMotion ? 0.7 : 0.85,
              className: reducedMotion ? undefined : "acg-pulse",
            });
            marker.bindTooltip(`${count} ${kind}`);
            marker.on("click", () => {
              map.setView([Number(item.lat), Number(item.lng)], Math.min(20, map.getZoom() + 2));
            });
            marker.addTo(group);
            continue;
          }
          if (item.lat == null || item.lng == null) continue;
          const color = markerColor(kind, String(item.status || ""), String(item.severity || ""));
          const marker = L.circleMarker([Number(item.lat), Number(item.lng)], {
            radius: kind === "BUILDING" ? 10 : 7,
            color: "#0b1220",
            weight: 1,
            fillColor: color,
            fillOpacity: 0.9,
          });
          const label = String(item.name || item.cameraId || item.incidentId || kind);
          marker.bindPopup(
            `<strong>${label}</strong><br/>Status: ${item.status ?? "—"}<br/>${
              item.severity ? `Severity: ${item.severity}<br/>` : ""
            }<em>${kind}</em>`
          );
          marker.on("click", () => onSelectRef.current({ kind, ...item }));
          marker.addTo(group);

          if (showCoverage && kind === "CAMERA" && item.coverage) {
            const cov = item.coverage as {
              radiusM?: number | null;
              estimate?: boolean;
            };
            if (cov.radiusM && cov.radiusM > 0) {
              L.circle([Number(item.lat), Number(item.lng)], {
                radius: cov.radiusM,
                color: color,
                weight: 1,
                fillOpacity: 0.08,
                dashArray: cov.estimate ? "4 4" : undefined,
              })
                .bindTooltip("Coverage estimate")
                .addTo(group);
            }
          }
        }
      };

      addPoints(objects.buildings, "BUILDING");
      addPoints(objects.cameras, "CAMERA");
      addPoints(objects.incidents, "INCIDENT");
      addPoints(objects.alerts, "ALERT");
      addPoints(objects.responseTeams, "RESPONSE_TEAM");
      addPoints(objects.exits, "EXIT");
      addPoints(objects.assemblyAreas, "ASSEMBLY_AREA");
      addPoints(objects.assets, "ASSET");

      if (heatmap?.cells) {
        for (const cell of heatmap.cells as Array<Record<string, unknown>>) {
          if (cell.lat == null || cell.lng == null) continue;
          const level = String(cell.level);
          const fill =
            level === "CRITICAL"
              ? "#ef4444"
              : level === "HIGH"
                ? "#f97316"
                : level === "MODERATE"
                  ? "#eab308"
                  : level === "LOW"
                    ? "#22c55e"
                    : "#64748b";
          L.circle([Number(cell.lat), Number(cell.lng)], {
            radius: 80,
            color: fill,
            fillColor: fill,
            fillOpacity: level === "INSUFFICIENT_DATA" ? 0.1 : 0.25,
            weight: 1,
          })
            .bindTooltip(`${cell.name}: ${level}`)
            .on("click", () => onSelectRef.current({ kind: "RISK", ...cell }))
            .addTo(group);
        }
      }

      // zones polygons
      if (objects.zones) {
        for (const z of objects.zones as Array<Record<string, unknown>>) {
          const geom = z.geometry as { coordinates?: number[][][] } | null;
          const ring = geom?.coordinates?.[0];
          if (!ring?.length) continue;
          const latlngs = ring.map((c) => [c[1], c[0]] as [number, number]);
          L.polygon(latlngs, {
            color: "#a78bfa",
            weight: 2,
            fillOpacity: 0.15,
            dashArray: "6 4",
          })
            .bindTooltip(String(z.name))
            .addTo(group);
        }
      }
    })();
  }, [objects, heatmap, showCoverage, reducedMotion]);

  return (
    <div className="relative h-full min-h-[520px] w-full">
      <div ref={containerRef} className="h-full min-h-[520px] w-full" role="application" aria-label="Campus map" />
      <style jsx global>{`
        @media (prefers-reduced-motion: no-preference) {
          .acg-pulse {
            animation: acgPulse 1.6s ease-in-out infinite;
          }
          @keyframes acgPulse {
            0%,
            100% {
              opacity: 0.85;
            }
            50% {
              opacity: 0.45;
            }
          }
        }
        .leaflet-container {
          background: #060a12;
          font: inherit;
        }
      `}</style>
    </div>
  );
}
