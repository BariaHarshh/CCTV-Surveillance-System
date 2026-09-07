import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewVideo, canConfigureVideo } from "@/lib/video/permissions";
import {
  createMaintenanceTicket,
  getVideoAnalytics,
  listVideoCameras,
  suggestMaintenance,
} from "@/lib/video/video-service";
import { connectDB } from "@/lib/db/connect";
import { Camera } from "@/models/Camera";
import { CameraMaintenance, VideoWallPreset, newVideoId } from "@/models/Video";
import { orgFilter } from "@/lib/campus/service";
import { logAuditEvent } from "@/lib/audit/log";
import mongoose from "mongoose";
import { getOrCreateVideoPolicy } from "@/lib/video/pipeline";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewVideo(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "analytics";

    if (view === "analytics") {
      return apiSuccess({ analytics: await getVideoAnalytics(organizationId) });
    }
    if (view === "inventory") {
      const cameras = await listVideoCameras(organizationId, {});
      const policy = await getOrCreateVideoPolicy(organizationId);
      return apiSuccess({
        inventory: {
          total: cameras.length,
          online: cameras.filter((c) => c.status === "ONLINE").length,
          offline: cameras.filter((c) => c.status === "OFFLINE").length,
          maintenance: cameras.filter((c) => c.status === "MAINTENANCE").length,
          aiMode: policy.processingMode,
          aiDisabled: policy.processingMode === "DISABLED",
        },
        cameras,
      });
    }
    if (view === "maintenance") {
      await connectDB();
      const tickets = await CameraMaintenance.find(orgFilter(organizationId)).sort({ createdAt: -1 }).limit(100);
      const suggestions = await suggestMaintenance(organizationId);
      return apiSuccess({
        tickets: tickets.map((t) => ({
          ticketId: t.ticketId,
          cameraId: t.cameraId.toString(),
          issue: t.issue,
          priority: t.priority,
          status: t.status,
          recommendationOnly: t.recommendationOnly,
        })),
        suggestions,
      });
    }
    if (view === "wall") {
      await connectDB();
      const presets = await VideoWallPreset.find(orgFilter(organizationId));
      const cameras = await listVideoCameras(organizationId, { status: "ONLINE" });
      return apiSuccess({
        presets: presets.map((p) => ({
          presetId: p.presetId,
          name: p.name,
          kind: p.kind,
          layout: p.layout,
          cameraIds: p.cameraIds.map((id) => id.toString()),
        })),
        cameras: cameras.slice(0, 16),
      });
    }
    return apiError("Unknown view", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canConfigureVideo(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "maintenance") {
      const ticket = await createMaintenanceTicket(organizationId, {
        cameraId: String(body.cameraId),
        issue: String(body.issue || "Maintenance"),
        priority: body.priority,
        assignedTeam: body.assignedTeam,
        recommendationOnly: Boolean(body.recommendationOnly),
        createdBy: user._id.toString(),
      });
      return apiSuccess({ ticket: { ticketId: ticket.ticketId } }, 201);
    }

    if (action === "bulk") {
      await connectDB();
      const ids: string[] = body.cameraIds || [];
      const op = String(body.op || "");
      const cams = await Camera.find(
        orgFilter(organizationId, {
          _id: { $in: ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) },
        })
      );
      if (op === "enable_ai" || op === "disable_ai") {
        const policy = await getOrCreateVideoPolicy(organizationId);
        if (op === "enable_ai") {
          const set = new Set(policy.enabledCameraIds.map((id) => id.toString()));
          for (const c of cams) set.add(c._id.toString());
          policy.enabledCameraIds = [...set].map((id) => new mongoose.Types.ObjectId(id));
          if (policy.processingMode === "DISABLED") policy.processingMode = "ON_DEMAND";
        } else {
          const remove = new Set(cams.map((c) => c._id.toString()));
          policy.enabledCameraIds = policy.enabledCameraIds.filter((id) => !remove.has(id.toString()));
        }
        await policy.save();
      }
      await logAuditEvent({
        actor: user,
        action: "CAMERA_BULK_UPDATED",
        description: `Bulk ${op} on ${cams.length} cameras`,
        metadata: { op, count: cams.length },
      });
      return apiSuccess({ updated: cams.length });
    }

    if (action === "wall_preset") {
      await connectDB();
      const preset = await VideoWallPreset.create({
        presetId: newVideoId("vwp"),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        name: String(body.name || "Preset"),
        kind: body.kind || "CUSTOM",
        layout: Number(body.layout || 4),
        cameraIds: (body.cameraIds || [])
          .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
          .map((id: string) => new mongoose.Types.ObjectId(id)),
        createdBy: user._id,
      });
      return apiSuccess({ preset: { presetId: preset.presetId } }, 201);
    }

    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
