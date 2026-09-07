import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { retryDeadLetter } from "@/lib/enterprise/job-queue";
import { BackgroundJob } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const jobs = await BackgroundJob.find({ status: "DEAD" }).sort({ updatedAt: -1 }).limit(100).lean();
    return apiSuccess({ jobs });
  } catch (error) {
    return handleApiError(error);
  }
}

const retrySchema = z.object({
  jobId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const parsed = retrySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid retry request.", 400, "VALIDATION_ERROR");
    const job = await retryDeadLetter(parsed.data.jobId);
    return apiSuccess({ job });
  } catch (error) {
    return handleApiError(error);
  }
}
