import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrCreateRetentionPolicy, updateRetentionPolicy } from "@/lib/platform/retention-worker";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    const policy = await getOrCreateRetentionPolicy(organizationId);
    return apiSuccess({
      policy: {
        eventsDays: policy.eventsDays,
        alertsDays: policy.alertsDays,
        incidentsDays: policy.incidentsDays,
        emergenciesDays: policy.emergenciesDays,
        cameraMetadataDays: policy.cameraMetadataDays,
        aiResultsDays: policy.aiResultsDays,
        auditDays: policy.auditDays,
        reportsDays: policy.reportsDays,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    const body = await request.json();
    const policy = await updateRetentionPolicy(organizationId, body);
    await logAuditEvent({ actor: user, action: "RETENTION_UPDATED", description: `${user.name} updated retention policy`, request });
    return apiSuccess({ policy });
  } catch (error) {
    return handleApiError(error);
  }
}
