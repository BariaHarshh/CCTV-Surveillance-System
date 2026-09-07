import type { IUser } from "@/models/User";
import { canViewSensitiveLocations, canViewTeamLocations } from "@/lib/map/permissions";
import { logAuditEvent } from "@/lib/audit/log";

export type LocationPrecision = "EXACT" | "BUILDING" | "CAMPUS" | "HIDDEN";

export function resolveLocationPrecision(
  user: Pick<IUser, "role" | "permissions">,
  kind: "camera" | "team" | "asset" | "exit" | "incident" | "sensitive"
): LocationPrecision {
  if (kind === "team" && !canViewTeamLocations(user)) return "HIDDEN";
  if (kind === "sensitive" && !canViewSensitiveLocations(user)) return "BUILDING";
  if (!canViewSensitiveLocations(user) && (kind === "exit" || kind === "asset")) {
    return "BUILDING";
  }
  return "EXACT";
}

export function redactCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
  precision: LocationPrecision
): { lat: number | null; lng: number | null; redacted: boolean } {
  if (precision === "HIDDEN") return { lat: null, lng: null, redacted: true };
  if (lat == null || lng == null) return { lat: null, lng: null, redacted: false };
  if (precision === "EXACT") return { lat, lng, redacted: false };
  if (precision === "CAMPUS") {
    return { lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10, redacted: true };
  }
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000, redacted: true };
}

export async function auditLocationView(opts: {
  actor?: IUser | null;
  targetType: string;
  targetId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  await logAuditEvent({
    actor: opts.actor,
    action: "LOCATION_VIEWED",
    description: opts.description,
    targetType: opts.targetType,
    targetId: opts.targetId,
    severity: "info",
    metadata: { ...opts.metadata, privacy: true },
  });
}
