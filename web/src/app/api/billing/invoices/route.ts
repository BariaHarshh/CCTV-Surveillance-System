import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getBillingOverview } from "@/lib/platform/billing-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    const overview = await getBillingOverview(organizationId);
    return apiSuccess({ invoices: overview.invoices });
  } catch (error) {
    return handleApiError(error);
  }
}
