import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { orgFilter } from "@/lib/campus/service";
import { getAIStatus } from "@/lib/intelligence/providers";
import { getOrCreateAutonomy } from "@/lib/enterprise/agent-service";
import { Alert } from "@/models/Alert";
import { Camera } from "@/models/Camera";
import { Incident } from "@/models/Incident";
import { ApprovalRequest, Automation, WorkflowRun } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const oid = new mongoose.Types.ObjectId(organizationId);

    const [
      openIncidents,
      activeAlerts,
      camerasTotal,
      camerasOffline,
      pendingApprovals,
      failedAutomations,
      failedRuns,
      autonomy,
    ] = await Promise.all([
      Incident.countDocuments({
        organizationId: oid,
        status: { $in: ["OPEN", "INVESTIGATING", "CONTAINED"] },
      }),
      Alert.countDocuments({
        organizationId: oid,
        status: { $in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] },
      }),
      Camera.countDocuments(orgFilter(organizationId)),
      Camera.countDocuments(
        orgFilter(organizationId, { status: { $in: ["OFFLINE", "ERROR", "DISCONNECTED"] } })
      ),
      ApprovalRequest.countDocuments({ organizationId: oid, status: "PENDING" }),
      Automation.countDocuments({ organizationId: oid, status: "ERROR" }),
      WorkflowRun.countDocuments({ organizationId: oid, status: "FAILED" }),
      getOrCreateAutonomy(organizationId),
    ]);

    const ai = getAIStatus();

    return apiSuccess({
      cards: {
        incidents: openIncidents,
        alerts: activeAlerts,
        cameras: { total: camerasTotal, offline: camerasOffline },
        approvals: pendingApprovals,
        failedAutomations,
        failedRuns,
        ai: {
          available: ai.available,
          mode: ai.mode,
          model: ai.model,
          writeEnabled: autonomy.aiWriteActionsEnabled,
          analysisEnabled: autonomy.aiAnalysisEnabled,
          defaultMode: autonomy.defaultMode,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
