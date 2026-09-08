import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps } from "@/lib/mobile/permissions";
import { getMapBootstrap } from "@/lib/map/map-service";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const bootstrap = await getMapBootstrap(organizationId, user);
    return apiSuccess({
      map: {
        campus: bootstrap.campus,
        buildings: bootstrap.buildings?.slice?.(0, 50) ?? bootstrap.buildings,
        activeEmergency: bootstrap.activeEmergency,
        href: "/map",
        mobileHref: "/mobile/map",
        note: "Uses Step 14 map data — no fabricated live GPS",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
