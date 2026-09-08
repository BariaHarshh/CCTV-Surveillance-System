import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrCreateOrgProfile } from "@/lib/platform/settings-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    const profile = await getOrCreateOrgProfile(organizationId);
    return apiSuccess({
      passwordPolicy: profile.passwordPolicy,
      sessionPolicy: profile.sessionPolicy,
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
    const profile = await getOrCreateOrgProfile(organizationId);
    if (body.passwordPolicy) profile.passwordPolicy = { ...profile.passwordPolicy, ...body.passwordPolicy };
    if (body.sessionPolicy) profile.sessionPolicy = { ...profile.sessionPolicy, ...body.sessionPolicy };
    await profile.save();
    await logAuditEvent({ actor: user, action: "SECURITY_POLICY_UPDATED", description: `${user.name} updated security policy`, request });
    return apiSuccess({ passwordPolicy: profile.passwordPolicy, sessionPolicy: profile.sessionPolicy });
  } catch (error) {
    return handleApiError(error);
  }
}
