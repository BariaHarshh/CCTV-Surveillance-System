import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { AIMessage } from "@/models/Intelligence";
import { connectDB } from "@/lib/db/connect";

const schema = z.object({
  messageId: z.string().min(1),
  feedback: z.enum(["helpful", "not_helpful"]),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN", "STAFF"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid request body.", 400, "VALIDATION_ERROR");

    await connectDB();
    const msg = await AIMessage.findOneAndUpdate(
      {
        messageId: parsed.data.messageId,
        organizationId: new mongoose.Types.ObjectId(organizationId),
        userId: user._id,
        role: { $in: ["assistant", "action_confirm", "warning"] },
      },
      { $set: { feedback: parsed.data.feedback } },
      { new: true }
    );
    if (!msg) return apiError("Message not found.", 404, "RESOURCE_NOT_FOUND");

    return apiSuccess({
      messageId: msg.messageId,
      feedback: msg.feedback,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
