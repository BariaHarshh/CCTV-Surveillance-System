import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getOrCreateOrgProfile, updateOrgSettings } from "@/lib/platform/settings-service";
import { Organization } from "@/models/Organization";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    const [org, profile] = await Promise.all([
      Organization.findById(organizationId).lean(),
      getOrCreateOrgProfile(organizationId),
    ]);
    return apiSuccess({
      organization: org
        ? {
            id: org._id.toString(),
            organizationId: org.organizationId,
            basicInformation: org.basicInformation,
            location: org.location,
            status: org.status,
          }
        : null,
      profile: {
        timezone: profile.timezone,
        language: profile.language,
        currency: profile.currency,
        dateFormat: profile.dateFormat,
        branding: profile.branding,
        sessionPolicy: profile.sessionPolicy,
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
    const result = await updateOrgSettings(organizationId, body);

    await logAuditEvent({
      actor: user,
      action: "SETTINGS_UPDATED",
      description: `${user.name} updated organization settings`,
      request,
      targetType: "Organization",
      targetId: organizationId,
      metadata: { organizationId },
    });

    return apiSuccess({
      organization: {
        id: result.organization._id.toString(),
        basicInformation: result.organization.basicInformation,
        location: result.organization.location,
      },
      profile: {
        timezone: result.profile.timezone,
        language: result.profile.language,
        currency: result.profile.currency,
        dateFormat: result.profile.dateFormat,
        branding: result.profile.branding,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
