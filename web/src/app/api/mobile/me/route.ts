import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps } from "@/lib/mobile/permissions";
import {
  getMobileHome,
  setStaffStatus,
  setLocationSharing,
  submitCheckIn,
} from "@/lib/mobile/field-service";
import { FIELD_STAFF_STATUSES } from "@/lib/mobile/constants";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const home = await getMobileHome(organizationId, user._id.toString());
    return apiSuccess({
      me: {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        status: home.myStatus,
      },
      ...home,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    if (body.status) {
      if (!(FIELD_STAFF_STATUSES as readonly string[]).includes(body.status)) {
        return apiError("Invalid status", 400, "VALIDATION");
      }
      const result = await setStaffStatus(organizationId, user, body.status, body.note);
      return apiSuccess({ status: result });
    }
    if (typeof body.locationSharingEnabled === "boolean") {
      const result = await setLocationSharing(organizationId, user, body.locationSharingEnabled, body.coords);
      return apiSuccess({ location: result });
    }
    return apiError("Nothing to update", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    if (body.action === "checkin") {
      const result = await submitCheckIn(organizationId, user, {
        status: body.status,
        emergencyId: body.emergencyId,
        note: body.note,
        lat: body.lat,
        lng: body.lng,
        accuracyM: body.accuracyM,
        demo: body.demo,
      });
      return apiSuccess({ checkIn: result }, 201);
    }
    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
