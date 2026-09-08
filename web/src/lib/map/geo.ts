import type { RiskLevel } from "@/lib/map/constants";

export function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLng(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function validateLatLng(lat: number, lng: number): { ok: true } | { ok: false; error: string } {
  if (!isValidLat(lat)) return { ok: false, error: "Latitude must be between -90 and 90." };
  if (!isValidLng(lng)) return { ok: false, error: "Longitude must be between -180 and 180." };
  return { ok: true };
}

export function toGeoPoint(lng: number, lat: number) {
  const v = validateLatLng(lat, lng);
  if (!v.ok) throw new Error(v.error);
  return { type: "Point" as const, coordinates: [lng, lat] as [number, number] };
}

export function fromGeoPoint(point: { coordinates: number[] } | null | undefined): {
  lat: number;
  lng: number;
} | null {
  if (!point?.coordinates || point.coordinates.length < 2) return null;
  const [lng, lat] = point.coordinates;
  if (!isValidLat(lat) || !isValidLng(lng)) return null;
  return { lat, lng };
}

export function pointFromLatLng(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return null;
  const v = validateLatLng(lat, lng);
  if (!v.ok) return null;
  return toGeoPoint(lng, lat);
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function parseBounds(raw: string | null | undefined): Bounds | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (!isValidLng(west) || !isValidLng(east) || !isValidLat(south) || !isValidLat(north)) return null;
  if (west > east || south > north) return null;
  return { west, south, east, north };
}

export function inBounds(lat: number, lng: number, b: Bounds): boolean {
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function validatePolygonRing(ring: Array<[number, number]>): { ok: true } | { ok: false; error: string } {
  if (ring.length < 4) return { ok: false, error: "Polygon ring needs at least 4 positions (closed)." };
  for (const [lng, lat] of ring) {
    const v = validateLatLng(lat, lng);
    if (!v.ok) return v;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return { ok: false, error: "Polygon ring must be closed (first equals last)." };
  }
  return { ok: true };
}

export interface Clusterable {
  id: string;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

export interface MarkerCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  ids: string[];
  isCluster: boolean;
  items?: Clusterable[];
}

/** Simple grid clustering for viewport payloads (server-side). */
export function clusterPoints(
  points: Clusterable[],
  zoom: number,
  threshold = 48
): MarkerCluster[] {
  if (zoom >= 16 || points.length <= 1) {
    return points.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      count: 1,
      ids: [p.id],
      isCluster: false,
      items: [p],
    }));
  }
  const cell = Math.max(0.0001, threshold / Math.pow(2, Math.max(0, zoom - 8)) / 111320);
  const buckets = new Map<string, Clusterable[]>();
  for (const p of points) {
    const key = `${Math.floor(p.lat / cell)}:${Math.floor(p.lng / cell)}`;
    const list = buckets.get(key) ?? [];
    list.push(p);
    buckets.set(key, list);
  }
  const out: MarkerCluster[] = [];
  for (const [key, items] of buckets) {
    if (items.length === 1) {
      const p = items[0];
      out.push({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        count: 1,
        ids: [p.id],
        isCluster: false,
        items: [p],
      });
      continue;
    }
    const lat = items.reduce((s, i) => s + i.lat, 0) / items.length;
    const lng = items.reduce((s, i) => s + i.lng, 0) / items.length;
    out.push({
      id: `cluster_${key}`,
      lat,
      lng,
      count: items.length,
      ids: items.map((i) => i.id),
      isCluster: true,
      items,
    });
  }
  return out;
}

export function riskLevelFromScore(score: number | null, sampleSize: number): RiskLevel {
  if (sampleSize < 3 || score == null) return "INSUFFICIENT_DATA";
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "MODERATE";
  return "LOW";
}

export function dayPartFromHour(hour: number): "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" {
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 21) return "EVENING";
  return "NIGHT";
}

export function resolveTimeRange(
  key: string,
  customFrom?: string | null,
  customTo?: string | null
): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  switch (key) {
    case "TODAY":
      from.setHours(0, 0, 0, 0);
      break;
    case "7D":
      from.setDate(from.getDate() - 7);
      break;
    case "30D":
      from.setDate(from.getDate() - 30);
      break;
    case "90D":
      from.setDate(from.getDate() - 90);
      break;
    case "CUSTOM":
      if (customFrom) from.setTime(Date.parse(customFrom));
      else from.setDate(from.getDate() - 30);
      if (customTo) to.setTime(Date.parse(customTo));
      break;
    default:
      from.setDate(from.getDate() - 7);
  }
  return { from, to };
}

/** Future 3D adapter surface — 2D remains primary. */
export interface SpatialNode3DAdapter {
  id: string;
  kind: "campus" | "building" | "floor" | "room" | "asset" | "sensor" | "camera" | "event";
  parentId: string | null;
  position2d: { lat: number; lng: number } | null;
  positionFloor: { x: number; y: number; floorId: string } | null;
  /** Reserved for future elevation / 3D meshes — unused in Step 14. */
  elevationM?: number | null;
  meshRef?: string | null;
}
