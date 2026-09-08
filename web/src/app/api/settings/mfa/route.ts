import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { beginMfaEnrollment, disableMfa, getMfaStatus, regenerateRecoveryCodes, verifyAndEnableMfa } from "@/lib/platform/mfa-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    const { user } = await requireOrgMember();
    return apiSuccess({ mfa: await getMfaStatus(user._id.toString()) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const body = await request.json();
    const action = body.action as string;
    const userId = user._id.toString();

    if (action === "begin") {
      const result = await beginMfaEnrollment(userId, organizationId, user.email);
      return apiSuccess({ enrollment: { otpauth: result.otpauth, secret: result.secret } });
    }
    if (action === "verify") {
      if (!body.code) return apiError("Code required.", 400, "VALIDATION_ERROR");
      const result = await verifyAndEnableMfa(userId, body.code);
      await logAuditEvent({ actor: user, action: "MFA_ENABLED", description: `${user.name} enabled MFA`, request });
      return apiSuccess({ enabled: true, recoveryCodes: result.recoveryCodes });
    }
    if (action === "disable") {
      await disableMfa(userId);
      await logAuditEvent({ actor: user, action: "MFA_DISABLED", description: `${user.name} disabled MFA`, request });
      return apiSuccess({ enabled: false });
    }
    if (action === "regenerate") {
      const result = await regenerateRecoveryCodes(userId);
      return apiSuccess({ recoveryCodes: result.recoveryCodes });
    }
    return apiError("Unknown MFA action.", 400, "VALIDATION_ERROR");
  } catch (error) {
    return handleApiError(error);
  }
}
