import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { VideoModelDeployment, newVideoId } from "@/models/Video";
import { logAuditEvent } from "@/lib/audit/log";
import { VIDEO_MODEL_LIFECYCLE } from "@/lib/video/constants";

export async function POST(request: Request) {
  try {
    const admin = await requireSuperAdmin();
    const body = await request.json();
    const action = String(body.action || "create");
    await connectDB();

    if (action === "create") {
      const dep = await VideoModelDeployment.create({
        deploymentId: newVideoId("vmd"),
        organizationId: null,
        modelId: String(body.modelId || "unknown"),
        version: String(body.version || "1.0"),
        lifecycle: "DRAFT",
        purpose: String(body.purpose || ""),
        createdBy: admin._id,
      });
      return apiSuccess({ deployment: { deploymentId: dep.deploymentId, lifecycle: dep.lifecycle } }, 201);
    }

    if (action === "transition") {
      const deploymentId = String(body.deploymentId || "");
      const lifecycle = String(body.lifecycle || "");
      if (!(VIDEO_MODEL_LIFECYCLE as readonly string[]).includes(lifecycle)) {
        return apiError("Invalid lifecycle", 400, "VALIDATION");
      }
      if (lifecycle === "DEPLOYED") {
        const current = await VideoModelDeployment.findOne({ deploymentId });
        if (!current || !["APPROVED", "TESTING"].includes(current.lifecycle)) {
          return apiError("Model must be evaluated/APPROVED before DEPLOYED", 400, "POLICY");
        }
        await VideoModelDeployment.updateMany(
          { modelId: current.modelId, lifecycle: "DEPLOYED", deploymentId: { $ne: deploymentId } },
          { $set: { lifecycle: "DISABLED" } }
        );
        current.lifecycle = "DEPLOYED";
        current.deployedAt = new Date();
        await current.save();
        await logAuditEvent({
          actor: admin,
          action: "VIDEO_MODEL_DEPLOYED",
          description: `Deployed model ${current.modelId} ${current.version}`,
          targetId: deploymentId,
        });
        return apiSuccess({ deployment: { deploymentId, lifecycle: "DEPLOYED" } });
      }

      const updated = await VideoModelDeployment.findOneAndUpdate(
        { deploymentId },
        {
          $set: {
            lifecycle,
            ...(body.metrics ? { metrics: body.metrics, evaluatedAt: new Date() } : {}),
          },
        },
        { new: true }
      );
      if (!updated) return apiError("Not found", 404, "NOT_FOUND");
      return apiSuccess({ deployment: { deploymentId, lifecycle: updated.lifecycle } });
    }

    if (action === "rollback") {
      const deploymentId = String(body.deploymentId || "");
      const current = await VideoModelDeployment.findOne({ deploymentId });
      const prevId = String(body.previousDeploymentId || current?.previousDeploymentId || "");
      const prev = await VideoModelDeployment.findOne({
        deploymentId: prevId,
        lifecycle: { $in: ["APPROVED", "DISABLED", "DEPLOYED"] },
      });
      if (!prev) return apiError("Previous deployment not found", 404, "NOT_FOUND");
      if (current) {
        current.lifecycle = "DISABLED";
        await current.save();
      }
      prev.lifecycle = "DEPLOYED";
      prev.deployedAt = new Date();
      await prev.save();
      await logAuditEvent({
        actor: admin,
        action: "VIDEO_MODEL_ROLLED_BACK",
        description: `Rolled back to ${prev.modelId} ${prev.version}`,
      });
      return apiSuccess({ deployment: { deploymentId: prev.deploymentId, lifecycle: "DEPLOYED" } });
    }

    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
