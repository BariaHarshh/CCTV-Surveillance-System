import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { OrganizationEmergencyState } from "@/models/Emergency";
import { Emergency } from "@/models/Emergency";
import { Incident } from "@/models/Incident";
import { Organization } from "@/models/Organization";
import { getSocketIO } from "@/lib/monitoring/socket-emitter";

/** Aggregated platform stats — no org-sensitive incident details. */
export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    await connectDB();

    const [orgsInEmergency, activeEmergencies, criticalIncidents, orgs] = await Promise.all([
      OrganizationEmergencyState.countDocuments({ mode: { $ne: "NORMAL" } }),
      Emergency.countDocuments({ status: { $in: ["ACTIVE", "CONTAINED"] }, source: { $ne: "TEST" } }),
      Incident.countDocuments({
        severity: "CRITICAL",
        status: { $in: ["OPEN", "INVESTIGATING", "CONTAINED"] },
        source: { $ne: "TEST" },
      }),
      Organization.countDocuments({ deletedAt: null }),
    ]);

    const modeBreakdown = await OrganizationEmergencyState.aggregate([
      { $group: { _id: "$mode", count: { $sum: 1 } } },
    ]);

    return apiSuccess({
      overview: {
        organizationsTotal: orgs,
        organizationsInEmergencyMode: orgsInEmergency,
        activeEmergencies,
        criticalIncidents,
        modeBreakdown: modeBreakdown.map((m: { _id: string; count: number }) => ({
          mode: m._id,
          count: m.count,
        })),
        systemHealth: {
          websocket: getSocketIO() ? "HEALTHY" : "DEGRADED",
          overall: getSocketIO() ? "HEALTHY" : "DEGRADED",
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
