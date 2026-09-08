import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canDownloadEvidence, canViewEvidence } from "@/lib/video/permissions";
import {
  createDownloadToken,
  createEvidencePackage,
  createSnapshotEvidence,
  listEvidence,
  requestClip,
  shareEvidence,
  viewEvidence,
} from "@/lib/video/evidence-service";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewEvidence(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const result = await viewEvidence(organizationId, user, id);
      if (!result) return apiError("Not found", 404, "NOT_FOUND");
      return apiSuccess({
        evidence: {
          videoEvidenceId: result.meta.videoEvidenceId,
          type: result.meta.type,
          available: result.meta.available,
          unavailableReason: result.meta.unavailableReason,
          hash: result.meta.hash,
          demo: result.meta.demo,
          message: result.message,
          hasContent: Boolean(result.content),
        },
      });
    }
    const evidence = await listEvidence(organizationId);
    return apiSuccess({ evidence });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewEvidence(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const action = String(body.action || "snapshot");

    if (action === "snapshot") {
      const meta = await createSnapshotEvidence({
        organizationId,
        user,
        cameraId: String(body.cameraId || ""),
        videoEventId: body.videoEventId,
        incidentId: body.incidentId,
        imageBuffer: body.base64
          ? Buffer.from(String(body.base64), "base64")
          : null,
        demo: Boolean(body.demo),
      });
      return apiSuccess(
        {
          evidence: {
            videoEvidenceId: meta.videoEvidenceId,
            available: meta.available,
            unavailableReason: meta.unavailableReason,
          },
        },
        201
      );
    }

    if (action === "clip") {
      const meta = await requestClip({
        organizationId,
        user,
        cameraId: String(body.cameraId || ""),
        eventAt: new Date(body.eventAt || Date.now()),
        beforeSec: body.beforeSec,
        afterSec: body.afterSec,
        videoEventId: body.videoEventId,
      });
      return apiSuccess({
        evidence: {
          videoEvidenceId: meta.videoEvidenceId,
          available: meta.available,
          unavailableReason: meta.unavailableReason,
          clipStart: meta.clipStart?.toISOString(),
          clipEnd: meta.clipEnd?.toISOString(),
        },
      });
    }

    if (action === "download") {
      if (!canDownloadEvidence(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      const token = await createDownloadToken(organizationId, user, String(body.videoEvidenceId || ""));
      if (!token) return apiError("Evidence unavailable", 404, "NOT_FOUND");
      return apiSuccess({ download: token });
    }

    if (action === "package") {
      const pack = await createEvidencePackage({
        organizationId,
        user,
        incidentId: String(body.incidentId || ""),
        videoEventIds: body.videoEventIds,
        evidenceIds: body.evidenceIds,
      });
      return apiSuccess(
        {
          package: {
            videoEvidenceId: pack.meta.videoEvidenceId,
            itemCount: pack.packagePayload.items.length,
            hash: pack.meta.hash,
          },
        },
        201
      );
    }

    if (action === "share") {
      if (!canDownloadEvidence(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      const shared = await shareEvidence({
        organizationId,
        user,
        videoEvidenceId: String(body.videoEvidenceId || ""),
        recipient: String(body.recipient || ""),
        purpose: String(body.purpose || "authorized share"),
        expiresInMinutes: body.expiresInMinutes,
      });
      if (!shared) return apiError("Not found", 404, "NOT_FOUND");
      return apiSuccess({ share: shared });
    }

    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
