import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { generateAdminUserId } from "@/lib/admins/service";
import { generateSecurePassword } from "@/lib/admins/password-generator";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const userId = await generateAdminUserId();
    const password = generateSecurePassword();
    return apiSuccess({ userId, password });
  } catch (error) {
    return handleApiError(error);
  }
}
