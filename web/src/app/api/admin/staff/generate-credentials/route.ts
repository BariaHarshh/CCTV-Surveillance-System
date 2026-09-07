import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { requirePermission } from "@/lib/auth/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { generateStaffUserId } from "@/lib/staff/service";
import { generateSecurePassword, assertPasswordStrength } from "@/lib/admins/password-generator";

export async function GET() {
  try {
    await ensureDbReady();
    const { user } = await requireAdmin();
    requirePermission(user, "staff:create");

    const userId = await generateStaffUserId();
    const password = generateSecurePassword();
    assertPasswordStrength(password);

    return apiSuccess({ userId, password });
  } catch (error) {
    return handleApiError(error);
  }
}
