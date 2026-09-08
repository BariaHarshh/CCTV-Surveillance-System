import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getInquiryStats, listInquiries } from "@/lib/inquiries/service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    if (params.stats === "true") {
      const stats = await getInquiryStats();
      return apiSuccess({ stats });
    }

    const result = await listInquiries({
      status: params.status,
      q: params.q,
      page: params.page ? parseInt(params.page, 10) : 1,
      limit: params.limit ? parseInt(params.limit, 10) : 20,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
