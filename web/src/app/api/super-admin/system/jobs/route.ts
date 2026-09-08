import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getJobStats } from "@/lib/enterprise/job-queue";
import { BackgroundJob } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const [stats, jobs] = await Promise.all([
      getJobStats(),
      BackgroundJob.find({}).sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    return apiSuccess({ stats, jobs });
  } catch (error) {
    return handleApiError(error);
  }
}
