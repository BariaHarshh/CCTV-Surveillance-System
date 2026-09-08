import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canConfigureVideoAI, canViewVideo } from "@/lib/video/permissions";
import { getOrCreateVideoPolicy } from "@/lib/video/pipeline";
import { connectDB } from "@/lib/db/connect";
import { VideoDetectionRule, PrivacyZone, CameraGroup, newVideoId } from "@/models/Video";
import { orgFilter } from "@/lib/campus/service";
import { logAuditEvent } from "@/lib/audit/log";
import mongoose from "mongoose";
import { VIDEO_AI_MODES } from "@/lib/video/constants";

export async function GET() {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewVideo(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const policy = await getOrCreateVideoPolicy(organizationId);
    await connectDB();
    const [rules, zones, groups] = await Promise.all([
      VideoDetectionRule.find(orgFilter(organizationId)).limit(100),
      PrivacyZone.find(orgFilter(organizationId)).limit(100),
      CameraGroup.find(orgFilter(organizationId)).limit(50),
    ]);
    return apiSuccess({
      policy: {
        processingMode: policy.processingMode,
        allowedCategories: policy.allowedCategories,
        enabledCameraIds: policy.enabledCameraIds.map((id) => id.toString()),
        dailyAiCallLimit: policy.dailyAiCallLimit,
        perCameraDailyLimit: policy.perCameraDailyLimit,
        framesPerSecondLimit: policy.framesPerSecondLimit,
        eventsPerMinuteLimit: policy.eventsPerMinuteLimit,
        evidenceRetentionDays: policy.evidenceRetentionDays,
        recordingRetentionDays: policy.recordingRetentionDays,
        snapshotRetentionDays: policy.snapshotRetentionDays,
        requireApprovalForSensitiveEvidence: policy.requireApprovalForSensitiveEvidence,
        demoMode: policy.demoMode,
      },
      rules: rules.map((r) => ({
        ruleId: r.ruleId,
        name: r.name,
        detectionType: r.detectionType,
        confidenceThreshold: r.confidenceThreshold,
        cooldownSec: r.cooldownSec,
        severity: r.severity,
        action: r.action,
        enabled: r.enabled,
      })),
      privacyZones: zones.map((z) => ({
        zoneId: z.zoneId,
        name: z.name,
        cameraId: z.cameraId.toString(),
        status: z.status,
      })),
      groups: groups.map((g) => ({
        groupId: g.groupId,
        name: g.name,
        kind: g.kind,
        cameraCount: g.cameraIds.length,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canConfigureVideoAI(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const policy = await getOrCreateVideoPolicy(organizationId);
    if (body.processingMode && (VIDEO_AI_MODES as readonly string[]).includes(body.processingMode)) {
      policy.processingMode = body.processingMode;
    }
    if (Array.isArray(body.allowedCategories)) policy.allowedCategories = body.allowedCategories.map(String);
    if (typeof body.demoMode === "boolean") policy.demoMode = body.demoMode;
    if (body.dailyAiCallLimit != null) policy.dailyAiCallLimit = Number(body.dailyAiCallLimit);
    if (body.evidenceRetentionDays != null) policy.evidenceRetentionDays = Number(body.evidenceRetentionDays);
    if (Array.isArray(body.enabledCameraIds)) {
      policy.enabledCameraIds = body.enabledCameraIds
        .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
        .map((id: string) => new mongoose.Types.ObjectId(id));
    }
    policy.updatedBy = user._id;
    await policy.save();
    await logAuditEvent({
      actor: user,
      action: "VIDEO_AI_POLICY_UPDATED",
      description: "Updated video AI policy",
    });
    return apiSuccess({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canConfigureVideoAI(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const kind = String(body.kind || "rule");
    await connectDB();

    if (kind === "rule") {
      const rule = await VideoDetectionRule.create({
        ruleId: newVideoId("vdr"),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        name: String(body.name || "Detection rule"),
        detectionType: String(body.detectionType || "MOTION_EVENT"),
        confidenceThreshold: Number(body.confidenceThreshold ?? 0.7),
        cooldownSec: Number(body.cooldownSec ?? 60),
        severity: String(body.severity || "MEDIUM"),
        action: body.action || "REVIEW",
        enabled: body.enabled !== false,
        createdBy: user._id,
      });
      return apiSuccess({ rule: { ruleId: rule.ruleId, name: rule.name } }, 201);
    }

    if (kind === "privacy_zone") {
      const zone = await PrivacyZone.create({
        zoneId: newVideoId("pz"),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        cameraId: new mongoose.Types.ObjectId(String(body.cameraId)),
        name: String(body.name || "Privacy mask"),
        geometry: Array.isArray(body.geometry) ? body.geometry : [],
        status: "ACTIVE",
        createdBy: user._id,
      });
      await logAuditEvent({
        actor: user,
        action: "PRIVACY_ZONE_CHANGED",
        description: `Created privacy zone ${zone.zoneId}`,
        targetId: zone.zoneId,
      });
      return apiSuccess({ zone: { zoneId: zone.zoneId, name: zone.name } }, 201);
    }

    if (kind === "group") {
      const group = await CameraGroup.create({
        groupId: newVideoId("cg"),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        name: String(body.name || "Group"),
        kind: String(body.groupKind || "CUSTOM"),
        cameraIds: (body.cameraIds || [])
          .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
          .map((id: string) => new mongoose.Types.ObjectId(id)),
      });
      return apiSuccess({ group: { groupId: group.groupId, name: group.name } }, 201);
    }

    return apiError("Unknown kind", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
