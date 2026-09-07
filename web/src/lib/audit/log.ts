import type { NextRequest } from "next/server";
import mongoose, { type Types } from "mongoose";
import { AuditLog, type AuditAction, type AuditSeverity } from "@/models/AuditLog";
import type { IUser } from "@/models/User";
import { getClientIp } from "@/lib/auth/rate-limit";

interface LogAuditParams {
  actor?: IUser | null;
  action: AuditAction;
  description: string;
  request?: NextRequest;
  targetType?: string | null;
  targetId?: Types.ObjectId | string | null;
  targetLabel?: string | null;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  organizationId?: string | null;
}

function resolveOrganizationId(
  actor: IUser | null | undefined,
  organizationId: string | null | undefined,
  metadata: Record<string, unknown>
): Types.ObjectId | null {
  const fromParam = organizationId ?? (metadata.organizationId as string | undefined);
  const fromActor = actor?.organizationId?.toString?.() ?? null;
  const raw = fromParam ?? fromActor;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

export async function logAuditEvent({
  actor,
  action,
  description,
  request,
  targetType = null,
  targetId = null,
  targetLabel = null,
  severity = "info",
  metadata = {},
  ipAddress,
  userAgent,
  organizationId,
}: LogAuditParams): Promise<void> {
  try {
    const orgId = resolveOrganizationId(actor, organizationId, metadata);
    const meta = { ...metadata };
    if (orgId && meta.organizationId == null) {
      meta.organizationId = orgId.toString();
    }
    await AuditLog.create({
      organizationId: orgId,
      actorId: actor?._id ?? null,
      actorName: actor?.name ?? "System",
      actorRole: actor?.role ?? "SYSTEM",
      action,
      targetType,
      targetId: targetId ?? null,
      targetLabel,
      description,
      severity,
      ipAddress: ipAddress ?? (request ? getClientIp(request) : "unknown"),
      userAgent: userAgent ?? request?.headers.get("user-agent") ?? "",
      metadata: meta,
    });
  } catch {
    // Audit logging must not block operations
  }
}
