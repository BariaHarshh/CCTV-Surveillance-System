import { z } from "zod";
import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { logAuthActivity } from "@/lib/auth/activity";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/lib/auth/password";
import { getClientIp } from "@/lib/auth/rate-limit";
import {
  getSessionTokenFromCookie,
  invalidateAllUserSessions,
  requireAuth,
} from "@/lib/auth/session";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { User } from "@/models/User";

const changeSchema = z
  .object({
    currentPassword: z.string().min(1, "Please enter your current password."),
    newPassword: z.string().min(1, "Please enter a new password."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();

    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";

    let user;
    try {
      user = await requireAuth();
    } catch {
      return apiError("Authentication required.", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const parsed = changeSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Invalid request.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const userWithPassword = await User.findById(user._id).select("+passwordHash");
    if (!userWithPassword) {
      return apiError("Authentication required.", 401, "UNAUTHORIZED");
    }

    const currentValid = await verifyPassword(currentPassword, userWithPassword.passwordHash);
    if (!currentValid) {
      return apiError("Current password is incorrect.", 400, "INVALID_CURRENT_PASSWORD");
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return apiError(passwordCheck.errors[0] ?? "Invalid password.", 400, "WEAK_PASSWORD");
    }

    userWithPassword.passwordHash = await hashPassword(newPassword);
    userWithPassword.passwordChangedAt = new Date();
    userWithPassword.mustChangePassword = false;
    await userWithPassword.save();

    const currentToken = await getSessionTokenFromCookie();
    await invalidateAllUserSessions(user._id.toString(), currentToken ?? undefined);

    await logAuthActivity({
      type: "PASSWORD_CHANGED",
      userId: user._id,
      ipAddress: ip,
      userAgent,
      metadata: { method: "change" },
    });

    return apiSuccess({ message: "Password changed successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
