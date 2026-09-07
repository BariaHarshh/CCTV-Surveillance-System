import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps } from "@/lib/mobile/permissions";
import { submitCheckIn } from "@/lib/mobile/field-service";
import { CHECKIN_STATUSES } from "@/lib/mobile/constants";

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    if (!(CHECKIN_STATUSES as readonly string[]).includes(body.status)) {
      return apiError("Invalid check-in status", 400, "VALIDATION");
    }
    const result = await submitCheckIn(organizationId, user, body);
    return apiSuccess({ checkIn: result }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
