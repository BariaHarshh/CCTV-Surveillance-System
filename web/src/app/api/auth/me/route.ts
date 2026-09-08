import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { clearSessionCookie, getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await ensureDbReady();

    const session = await getAuthSession();

    if (!session) {
      await clearSessionCookie();
      return apiError("Authentication required.", 401, "UNAUTHORIZED");
    }

    return apiSuccess({
      authenticated: true,
      user: toSafeUser(session.user),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
