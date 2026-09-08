import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getMessages } from "@/lib/intelligence/orchestrator";
import { AIConversation } from "@/models/Intelligence";
import { connectDB } from "@/lib/db/connect";

type Ctx = { params: Promise<{ conversationId: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const { conversationId } = await ctx.params;
    const messages = await getMessages(organizationId, conversationId, user._id.toString());
    return apiSuccess({
      conversationId,
      messages: messages.map((m) => ({
        messageId: m.messageId,
        role: m.role,
        content: m.content,
        blocks: m.blocks,
        sources: m.sources,
        confidence: m.confidence,
        toolsUsed: m.toolsUsed,
        model: m.model,
        provider: m.provider,
        pendingAction: m.pendingAction,
        feedback: m.feedback,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const { conversationId } = await ctx.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid request body.", 400, "VALIDATION_ERROR");
    if (!parsed.data.title && !parsed.data.status) {
      return apiError("Provide title and/or status.", 400, "VALIDATION_ERROR");
    }

    await connectDB();
    const update: Record<string, unknown> = {};
    if (parsed.data.title) update.title = parsed.data.title;
    if (parsed.data.status) update.status = parsed.data.status;

    const conv = await AIConversation.findOneAndUpdate(
      {
        conversationId,
        organizationId: new mongoose.Types.ObjectId(organizationId),
        userId: user._id,
        status: { $ne: "DELETED" },
      },
      { $set: update },
      { new: true }
    );
    if (!conv) return apiError("Conversation not found.", 404, "RESOURCE_NOT_FOUND");

    return apiSuccess({
      conversation: {
        conversationId: conv.conversationId,
        title: conv.title,
        status: conv.status,
        updatedAt: conv.updatedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const { conversationId } = await ctx.params;
    await connectDB();
    const conv = await AIConversation.findOneAndUpdate(
      {
        conversationId,
        organizationId: new mongoose.Types.ObjectId(organizationId),
        userId: user._id,
        status: { $ne: "DELETED" },
      },
      { $set: { status: "DELETED" } },
      { new: true }
    );
    if (!conv) return apiError("Conversation not found.", 404, "RESOURCE_NOT_FOUND");
    return apiSuccess({ deleted: true, conversationId });
  } catch (error) {
    return handleApiError(error);
  }
}
