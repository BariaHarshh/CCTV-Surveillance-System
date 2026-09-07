import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { AIUnansweredQuestion } from "@/models/Intelligence";
import { connectDB } from "@/lib/db/connect";
import mongoose from "mongoose";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return apiSuccess({ questions: [] });
    }
    await connectDB();
    const questions = await AIUnansweredQuestion.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: "OPEN",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return apiSuccess({
      questions: questions.map((q) => ({
        id: q._id.toString(),
        question: q.question,
        status: q.status,
        createdAt: q.createdAt?.toISOString?.() ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
