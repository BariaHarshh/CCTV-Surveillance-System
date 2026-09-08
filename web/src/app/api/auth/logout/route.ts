import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { logAuthActivity } from "@/lib/auth/activity";
import {
  clearSessionCookie,
  getSessionTokenFromCookie,
  invalidateSession,
} from "@/lib/auth/session";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getClientIp } from "@/lib/auth/rate-limit";
import { getAuthSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();

    const session = await getAuthSession();
    const token = await getSessionTokenFromCookie();
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";

    if (token) {
      await invalidateSession(token);
    }

    if (session) {
      await logAuthActivity({
        type: "LOGOUT",
        userId: session.user._id,
        ipAddress: ip,
        userAgent,
      });
    }

    await clearSessionCookie();

    return apiSuccess({ authenticated: false, message: "Logged out successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  return apiError("Method not allowed.", 405, "METHOD_NOT_ALLOWED");
}
