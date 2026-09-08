import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewMap } from "@/lib/map/permissions";
import { getMapAnalytics } from "@/lib/map/zone-service";
import { getOrCreateCampus } from "@/lib/campus/service";
import { connectDB } from "@/lib/db/connect";
import { Building } from "@/models/Building";
import { Camera } from "@/models/Camera";
import { Incident } from "@/models/Incident";
import { Emergency } from "@/models/Emergency";
import { orgFilter } from "@/lib/campus/service";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    await connectDB();
    const analytics = await getMapAnalytics(organizationId);
    const campus = await getOrCreateCampus(organizationId);
    const [buildings, cameras, incidents, emergencies] = await Promise.all([
      Building.countDocuments(orgFilter(organizationId)),
      Camera.find(orgFilter(organizationId)).select("status"),
      Incident.countDocuments(orgFilter(organizationId, { createdAt: { $gte: new Date(Date.now() - 30 * 864e5) } })),
      Emergency.countDocuments(orgFilter(organizationId)),
    ]);
    const online = cameras.filter((c) => c.status === "ONLINE").length;
    return apiSuccess({
      analytics,
      campusComparison: [
        {
          campusId: campus.campusId,
          name: campus.name,
          buildings,
          incidents30d: incidents,
          cameraHealthPct: cameras.length ? Math.round((online / cameras.length) * 100) : null,
          emergencies,
          risk:
            analytics.byArea.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.risk ??
            "INSUFFICIENT_DATA",
        },
      ],
      note: "Multi-campus comparison lists only campuses in the current organization.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
