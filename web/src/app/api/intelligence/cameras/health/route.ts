import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { buildCameraMaintenance } from "@/lib/intelligence/briefing";
import { assertAIAllowed } from "@/lib/intelligence/orchestrator";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    await assertAIAllowed(organizationId, user);
    const cameras = await buildCameraMaintenance(organizationId);
    return apiSuccess({ cameras, asOf: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
