import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { MaintenanceMode } from "@/models/Platform";
import { Emergency } from "@/models/Emergency";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    let mode = await MaintenanceMode.findOne().sort({ updatedAt: -1 });
    if (!mode) mode = await MaintenanceMode.create({ enabled: false });
    const activeEmergencies = await Emergency.countDocuments({ status: { $in: ["ACTIVE", "CONTAINED"] } });
    return apiSuccess({
      maintenance: {
        enabled: mode.enabled,
        message: mode.message,
        startTime: mode.startTime?.toISOString() ?? null,
        expectedEnd: mode.expectedEnd?.toISOString() ?? null,
        affectedServices: mode.affectedServices,
      },
      warnings: activeEmergencies > 0 ? [`${activeEmergencies} active emergency(ies) — do not silently disrupt response operations.`] : [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const user = await requireSuperAdmin();
    const body = await request.json();
    const activeEmergencies = await Emergency.countDocuments({ status: { $in: ["ACTIVE", "CONTAINED"] } });
    let mode = await MaintenanceMode.findOne().sort({ updatedAt: -1 });
    if (!mode) mode = new MaintenanceMode();
    mode.enabled = Boolean(body.enabled);
    if (body.message) mode.message = body.message;
    mode.startTime = body.enabled ? new Date() : null;
    mode.expectedEnd = body.expectedEnd ? new Date(body.expectedEnd) : null;
    mode.affectedServices = body.affectedServices ?? [];
    mode.updatedBy = user.name;
    await mode.save();
    await logAuditEvent({
      actor: user,
      action: "MAINTENANCE_UPDATED",
      description: `${user.name} ${body.enabled ? "enabled" : "disabled"} maintenance mode`,
      request,
      metadata: { activeEmergencies },
    });
    return apiSuccess({
      maintenance: { enabled: mode.enabled, message: mode.message },
      warnings: activeEmergencies > 0 ? [`${activeEmergencies} active emergencies present`] : [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
