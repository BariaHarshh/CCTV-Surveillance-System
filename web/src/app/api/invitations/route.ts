import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createInvitation, listInvitations } from "@/lib/platform/settings-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    return apiSuccess({ invitations: await listInvitations(organizationId) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    const body = await request.json();
    if (!body.email || !body.role) return apiError("email and role required.", 400, "VALIDATION_ERROR");
    const invitation = await createInvitation(organizationId, body, { id: user._id.toString(), name: user.name });
    await logAuditEvent({ actor: user, action: "INVITATION_CREATED", description: `${user.name} invited ${body.email}`, request });
    return apiSuccess({ invitation }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
