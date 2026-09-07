import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { Announcement } from "@/models/Platform";
import { getNextSequence } from "@/models/Counter";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const items = await Announcement.find().sort({ createdAt: -1 }).limit(50).lean();
    return apiSuccess({ announcements: items.map((a) => ({ id: a._id.toString(), announcementId: a.announcementId, type: a.type, title: a.title, message: a.message, target: a.target, active: a.active })) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const user = await requireSuperAdmin();
    const body = await request.json();
    if (!body.title || !body.message || !body.type) return apiError("title, message, type required.", 400, "VALIDATION_ERROR");
    const seq = await getNextSequence("announcement");
    const doc = await Announcement.create({
      announcementId: `ANN-${String(seq).padStart(6, "0")}`,
      type: body.type,
      title: body.title,
      message: body.message,
      target: body.target ?? "ALL",
      organizationIds: body.organizationIds ?? [],
      createdBy: user._id,
      active: true,
    });
    await logAuditEvent({ actor: user, action: "ANNOUNCEMENT_CREATED", description: `${user.name} created announcement ${doc.announcementId}`, request });
    return apiSuccess({ announcement: { id: doc._id.toString(), announcementId: doc.announcementId } }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
