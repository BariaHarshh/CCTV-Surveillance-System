import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canReviewDetections, canViewVideo } from "@/lib/video/permissions";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { VideoEvent } from "@/models/Video";
import { processVideoDetection } from "@/lib/video/pipeline";
import { submitEventFeedback } from "@/lib/ai/feedback-service";
import { logAuditEvent } from "@/lib/audit/log";
import mongoose from "mongoose";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewVideo(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    await connectDB();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (url.searchParams.get("review") === "1") filter.status = "NEEDS_REVIEW";
    const events = await VideoEvent.find(orgFilter(organizationId, filter))
      .sort({ timestamp: -1 })
      .limit(100);
    return apiSuccess({
      detections: events.map((e) => ({
        videoEventId: e.videoEventId,
        eventType: e.eventType,
        confidence: e.confidence,
        confidencePct: e.confidence != null ? Math.round(e.confidence * 100) : null,
        severity: e.severity,
        status: e.status,
        timestamp: e.timestamp.toISOString(),
        cameraId: e.cameraId.toString(),
        buildingId: e.buildingId?.toString() ?? null,
        demo: e.demo,
        eventGroupId: e.eventGroupId,
        modelVersion: e.modelVersion,
        linkedEventId: e.linkedEventId?.toString() ?? null,
        message: "AI detected — confidence is not confirmation",
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    const body = await request.json();
    const action = String(body.action || "ingest");

    if (action === "ingest") {
      // Internal/demo ingest — requires configure or review; demo must be labeled
      if (!canReviewDetections(user) && user.role !== "ADMIN") {
        return apiError("Forbidden", 403, "FORBIDDEN");
      }
      const result = await processVideoDetection({
        organizationId,
        cameraId: String(body.cameraId || ""),
        eventType: String(body.eventType || "MOTION_EVENT"),
        confidence: Number(body.confidence ?? 0),
        demo: Boolean(body.demo),
        zoneId: body.zoneId,
        modelId: body.modelId,
        modelVersion: body.modelVersion,
        metadata: body.metadata,
      });
      if (!result.ok) return apiError(result.reason || "Failed", 400, "VIDEO_PIPELINE");
      await logAuditEvent({
        actor: user,
        action: "VIDEO_DETECTION_CREATED",
        description: result.message || "Video detection",
        metadata: { videoEventId: result.videoEventId, demo: Boolean(body.demo) },
      });
      return apiSuccess({ result }, 201);
    }

    if (action === "review") {
      if (!canReviewDetections(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      await connectDB();
      const videoEventId = String(body.videoEventId || "");
      const decision = String(body.decision || "");
      const map: Record<string, string> = {
        CONFIRM: "CONFIRMED",
        FALSE_POSITIVE: "FALSE_POSITIVE",
        IGNORE: "IGNORED",
        NEEDS_REVIEW: "NEEDS_REVIEW",
      };
      const status = map[decision];
      if (!status) return apiError("Invalid decision", 400, "VALIDATION");
      const ev = await VideoEvent.findOneAndUpdate(
        orgFilter(organizationId, { videoEventId }),
        {
          $set: {
            status,
            reviewedBy: user._id,
            reviewedAt: new Date(),
            reviewNote: String(body.note || ""),
          },
        },
        { new: true }
      );
      if (!ev) return apiError("Detection not found", 404, "NOT_FOUND");

      if (ev.linkedEventId && (decision === "CONFIRM" || decision === "FALSE_POSITIVE")) {
        try {
          await submitEventFeedback(
            organizationId,
            ev.linkedEventId.toString(),
            { id: user._id.toString(), name: user.name },
            {
              feedbackType: decision === "CONFIRM" ? "CORRECT" : "FALSE_POSITIVE",
              reason: String(body.note || ""),
            }
          );
        } catch {
          // feedback optional if already submitted
        }
      }

      await logAuditEvent({
        actor: user,
        action: "VIDEO_DETECTION_REVIEWED",
        description: `Reviewed ${videoEventId} as ${status}`,
        targetType: "VideoEvent",
        targetId: videoEventId,
      });
      return apiSuccess({
        detection: {
          videoEventId: ev.videoEventId,
          status: ev.status,
          reviewedAt: ev.reviewedAt?.toISOString(),
        },
      });
    }

    if (action === "create_incident") {
      if (!canReviewDetections(user) && user.role !== "ADMIN") {
        return apiError("Forbidden", 403, "FORBIDDEN");
      }
      await connectDB();
      const videoEventId = String(body.videoEventId || "");
      const ev = await VideoEvent.findOne(orgFilter(organizationId, { videoEventId }));
      if (!ev) return apiError("Detection not found", 404, "NOT_FOUND");

      const { Camera } = await import("@/models/Camera");
      const cam = await Camera.findOne(orgFilter(organizationId, { _id: ev.cameraId }));
      const prefill = {
        title:
          body.title ||
          `AI detected ${ev.eventType.replace(/_/g, " ").toLowerCase()} — camera ${cam?.name || ev.cameraId}`,
        severity: body.severity || ev.severity,
        cameraId: ev.cameraId.toString(),
        cameraName: cam?.name ?? null,
        location: {
          campus: cam?.campusId?.toString?.() ?? "",
          building: cam?.buildingId?.toString?.() ?? "",
          floor: cam?.floor != null ? String(cam.floor) : "",
          room: cam?.roomId?.toString?.() ?? "",
          camera: cam?.name ?? ev.cameraId.toString(),
        },
        timestamp: ev.timestamp.toISOString(),
        detection: ev.eventType,
        confidence: ev.confidence,
        evidenceReference: ev.evidenceReference,
        videoEventId: ev.videoEventId,
        linkedEventId: ev.linkedEventId?.toString() ?? null,
        note: "AI detection is a signal — review before treating as confirmed",
      };

      if (body.submit && ev.linkedEventId) {
        const { createOrUpdateIncident } = await import("@/lib/ai/incident-service");
        const incident = await createOrUpdateIncident({
          organizationId,
          eventId: ev.linkedEventId.toString(),
          title: String(prefill.title),
          severity: (prefill.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") || "MEDIUM",
          riskScore: Math.round((ev.confidence ?? 0.5) * 100),
          location: prefill.location,
          source: "VIDEO_AI",
        });
        return apiSuccess({ prefill, incident });
      }

      return apiSuccess({ prefill, editRequired: !body.submit });
    }

    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
