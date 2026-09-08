import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps } from "@/lib/mobile/permissions";
import { Incident } from "@/models/Incident";
import { orgFilter } from "@/lib/campus/service";
import { connectDB } from "@/lib/db/connect";
import { createIncidentDraftFromSync } from "@/lib/mobile/incident-draft";
import { createNotification } from "@/lib/mobile/notification-bridge";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    await connectDB();
    const incidents = await Incident.find(
      orgFilter(organizationId, { status: { $nin: ["RESOLVED", "CLOSED"] } })
    )
      .sort({ createdAt: -1 })
      .limit(50);
    return apiSuccess({
      incidents: incidents.map((i) => ({
        id: i._id.toString(),
        incidentId: i.incidentId,
        title: i.title,
        severity: i.severity,
        status: i.status,
        href: `/admin/incidents/${i._id}`,
        videoHref: `/video/search?incident=${i._id}`,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const result = await createIncidentDraftFromSync(organizationId, user, {
      ...body,
      clientDraftId: body.clientDraftId || body.draftId || undefined,
    });
    if (!result.conflict) {
      await createNotification({
        organizationId,
        type: "INCIDENT",
        title: "Field incident reported",
        message: String(body.title || "New field report"),
        severity: (body.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") || "MEDIUM",
        category: "INCIDENTS",
        metadata: { incidentId: result.incidentId },
      });
    }
    return apiSuccess({ result }, result.conflict ? 409 : 201);
  } catch (e) {
    return handleApiError(e);
  }
}
