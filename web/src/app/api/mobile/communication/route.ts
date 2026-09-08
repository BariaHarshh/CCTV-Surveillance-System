import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewFieldOps, canBroadcast } from "@/lib/mobile/permissions";
import {
  getOrCreateChannel,
  listChannelMessages,
  postChannelMessage,
} from "@/lib/mobile/field-service";
import { publishAnnouncement, listAnnouncements } from "@/lib/mobile/ops-service";
import { createNotification } from "@/lib/mobile/notification-bridge";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    if (url.searchParams.get("announcements") === "1") {
      return apiSuccess({ announcements: await listAnnouncements(organizationId) });
    }
    const channelId = url.searchParams.get("channelId");
    const kind = url.searchParams.get("kind") as "INCIDENT" | "EMERGENCY" | "TEAM" | "TASK" | null;
    const refId = url.searchParams.get("refId");
    if (kind && refId) {
      const ch = await getOrCreateChannel(organizationId, kind, refId, `${kind} ${refId}`);
      const messages = await listChannelMessages(organizationId, ch.channelId);
      return apiSuccess({ channel: { channelId: ch.channelId, kind: ch.kind, title: ch.title }, messages });
    }
    if (channelId) {
      const messages = await listChannelMessages(organizationId, channelId);
      return apiSuccess({ messages });
    }
    return apiSuccess({ announcements: await listAnnouncements(organizationId) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewFieldOps(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const body = await request.json();
    const action = String(body.action || "message");

    if (action === "broadcast") {
      if (!canBroadcast(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      const testMode = Boolean(body.testMode);
      await createNotification({
        organizationId,
        type: "EMERGENCY",
        title: String(body.title || "Emergency notification"),
        message: String(body.message || ""),
        severity: (body.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") || "CRITICAL",
        category: "EMERGENCY",
        testMode,
        metadata: {
          location: body.location,
          instructions: body.instructions,
          expiresAt: body.expiresAt,
        },
      });
      await logAuditEvent({
        actor: user,
        action: "EMERGENCY_BROADCAST",
        description: `${testMode ? "[TEST] " : ""}Emergency broadcast: ${body.title}`,
        severity: "critical",
      });
      return apiSuccess({
        ok: true,
        testMode,
        note: testMode ? "TEST — not a production emergency message" : "Broadcast queued via notification system",
      });
    }

    if (action === "announce") {
      if (!canBroadcast(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      const row = await publishAnnouncement(organizationId, user, body);
      return apiSuccess({ announcement: { announcementId: row.announcementId } }, 201);
    }

    const kind = body.kind as "INCIDENT" | "EMERGENCY" | "TEAM" | "TASK";
    const ch = await getOrCreateChannel(
      organizationId,
      kind,
      String(body.refId || ""),
      String(body.title || `${kind}`)
    );
    const msg = await postChannelMessage(
      organizationId,
      user,
      ch.channelId,
      String(body.content || ""),
      body.attachments || []
    );
    return apiSuccess({ message: { messageId: msg?.messageId, channelId: ch.channelId } }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
