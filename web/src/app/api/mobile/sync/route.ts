import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps } from "@/lib/mobile/permissions";
import {
  enqueueOfflineOp,
  listSyncState,
  processSyncQueue,
  resolveConflict,
} from "@/lib/mobile/sync-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const state = await listSyncState(organizationId, user._id.toString());
    return apiSuccess({ sync: state });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const action = String(body.action || "enqueue");

    if (action === "enqueue") {
      const row = await enqueueOfflineOp(organizationId, user, {
        clientOpId: String(body.clientOpId || ""),
        operation: body.operation,
        resourceType: String(body.resourceType || ""),
        payload: body.payload || {},
      });
      return apiSuccess({ item: row }, 201);
    }
    if (action === "process") {
      const result = await processSyncQueue(organizationId, user);
      await logAuditEvent({
        actor: user,
        action: "MOBILE_SYNC",
        description: `Processed ${result.processed} offline ops`,
      });
      return apiSuccess(result);
    }
    if (action === "resolve") {
      const resolved = await resolveConflict(
        organizationId,
        user,
        String(body.syncId || ""),
        (body.resolution as "KEEP_SERVER" | "KEEP_LOCAL" | "REVIEW") || "REVIEW"
      );
      if (!resolved) return apiError("Not found", 404, "NOT_FOUND");
      if ("error" in resolved) return apiError(String(resolved.error), 400, String(resolved.error));
      return apiSuccess({ resolved });
    }
    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
