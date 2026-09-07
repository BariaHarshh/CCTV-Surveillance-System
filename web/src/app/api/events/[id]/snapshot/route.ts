import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewEvents } from "@/lib/monitoring/permissions";
import { apiError, handleApiError } from "@/lib/api/response";
import { getEventSnapshot } from "@/lib/monitoring/event-service";
import fs from "fs/promises";
import path from "path";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewEvents(user)) return apiError("Permission denied.", 403, "FORBIDDEN");

    const { id } = await params;
    const snapshot = await getEventSnapshot(organizationId, id);
    if (!snapshot) return apiError("No snapshot available.", 404, "NOT_FOUND");

    const filePath = path.join(process.cwd(), ".data", snapshot.storageKey);
    try {
      const buffer = await fs.readFile(filePath);
      return new Response(buffer, {
        headers: { "Content-Type": snapshot.contentType, "Cache-Control": "private, no-store" },
      });
    } catch {
      return apiError("Snapshot file unavailable.", 404, "NOT_FOUND");
    }
  } catch (error) {
    return handleApiError(error);
  }
}
