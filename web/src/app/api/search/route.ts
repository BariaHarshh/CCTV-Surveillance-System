import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { Camera } from "@/models/Camera";
import { Incident } from "@/models/Incident";
import { Alert } from "@/models/Alert";
import { User } from "@/models/User";
import { orgFilter } from "@/lib/campus/service";
import { can } from "@/lib/permissions/capabilities";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    if (!q || q.length < 2) return apiSuccess({ results: [] });
    await connectDB();
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const results: Array<{ type: string; id: string; title: string; href: string }> = [];

    if (can(user, "camera.view") || user.role === "ADMIN") {
      const cameras = await Camera.find(orgFilter(organizationId, { $or: [{ name: rx }, { cameraId: rx }] })).limit(8).lean();
      for (const c of cameras) results.push({ type: "camera", id: c._id.toString(), title: c.name, href: `/admin/cameras` });
    }
    if (can(user, "incident.view") || user.role === "ADMIN") {
      const incidents = await Incident.find(orgFilter(organizationId, { $or: [{ title: rx }, { incidentId: rx }] })).limit(8).lean();
      for (const i of incidents) results.push({ type: "incident", id: i._id.toString(), title: i.title ?? i.incidentId, href: `/admin/incidents/${i._id}` });
    }
    if (can(user, "alert.view") || user.role === "ADMIN") {
      const alerts = await Alert.find(orgFilter(organizationId, { $or: [{ title: rx }, { alertId: rx }] })).limit(8).lean();
      for (const a of alerts) results.push({ type: "alert", id: a._id.toString(), title: a.title ?? a.alertId, href: `/admin/alerts/${a._id}` });
    }
    if (user.role === "ADMIN") {
      const users = await User.find(orgFilter(organizationId, { $or: [{ name: rx }, { email: rx }], deletedAt: null })).limit(8).lean();
      for (const u of users) results.push({ type: "user", id: u._id.toString(), title: u.name, href: `/admin/staff` });
    }
    // Never return billing resources to unauthorized roles
    return apiSuccess({ results: results.slice(0, 25) });
  } catch (error) {
    return handleApiError(error);
  }
}
