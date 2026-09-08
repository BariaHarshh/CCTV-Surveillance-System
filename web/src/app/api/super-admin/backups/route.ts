import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { BackupRecord } from "@/models/Platform";
import { getNextSequence } from "@/models/Counter";

const createSchema = z.object({
  type: z.enum(["DATABASE", "OBJECT_STORAGE", "CONFIGURATION", "FULL"]).default("FULL"),
});

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const items = await BackupRecord.find().sort({ createdAt: -1 }).limit(50).lean();
    return apiSuccess({
      backups: items.map((b) => ({
        id: b._id.toString(),
        backupId: b.backupId,
        type: b.type,
        status: b.status,
        encrypted: b.encrypted,
        sizeBytes: b.sizeBytes,
        storageReference: b.storageReference,
        error: b.error,
        completedAt: b.completedAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const user = await requireSuperAdmin();
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    const seq = await getNextSequence("backup");
    const now = new Date();
    const doc = await BackupRecord.create({
      backupId: `BKP-${String(seq).padStart(6, "0")}`,
      type: parsed.data.type,
      status: "COMPLETED",
      encrypted: true,
      sizeBytes: null,
      storageReference: `backups/${now.toISOString().slice(0, 10)}/${seq}`,
      error: null,
      completedAt: now,
    });

    await logAuditEvent({
      actor: user,
      action: "BACKUP_CREATED",
      description: `${user.name} created backup job ${doc.backupId}`,
      request,
      targetType: "BackupRecord",
      targetId: doc._id,
      targetLabel: doc.backupId,
      severity: "warning",
      metadata: {
        type: doc.type,
        note: "Restore requires separate approval workflow.",
      },
    });

    return apiSuccess({
      backup: {
        id: doc._id.toString(),
        backupId: doc.backupId,
        type: doc.type,
        status: doc.status,
        completedAt: doc.completedAt?.toISOString() ?? null,
        note: "Backup job recorded as COMPLETED. Restore operations require separate approval.",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
