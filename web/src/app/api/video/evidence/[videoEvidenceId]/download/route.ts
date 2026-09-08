import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { canDownloadEvidence } from "@/lib/video/permissions";
import { consumeDownloadToken, viewEvidence } from "@/lib/video/evidence-service";

/**
 * Time-limited single-use download — requires auth + permission + matching token hash.
 * Never serves permanent public URLs.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ videoEvidenceId: string }> }
) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canDownloadEvidence(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const { videoEvidenceId } = await context.params;
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token || token.length < 16) return apiError("Invalid or missing token", 403, "FORBIDDEN");

    const grant = await consumeDownloadToken({
      organizationId,
      videoEvidenceId,
      token,
      actorId: user._id.toString(),
    });
    if (!grant) return apiError("Download authorization expired, used, or invalid", 403, "FORBIDDEN");

    const result = await viewEvidence(organizationId, user, videoEvidenceId);
    if (!result) return apiError("Not found", 404, "NOT_FOUND");
    if (!result.content) {
      return apiSuccess({
        available: false,
        message: result.message || "Recording unavailable.",
      });
    }

    return new Response(new Uint8Array(result.content), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${videoEvidenceId}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
