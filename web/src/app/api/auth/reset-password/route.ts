import { z } from "zod";
import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { logAuthActivity } from "@/lib/auth/activity";
import {
  hashPassword,
  validatePassword,
} from "@/lib/auth/password";
import { hashLookupToken } from "@/lib/auth/token-lookup";
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { invalidateAllUserSessions } from "@/lib/auth/session";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { User } from "@/models/User";

const resetSchema = z
  .object({
    token: z.string().min(1, "Reset token is required."),
    password: z.string().min(1, "Please enter a new password."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();

    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";

    const rateLimit = checkRateLimit(`reset:${ip}`, 10, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return apiError("Too many requests. Please try again later.", 429, "RATE_LIMITED");
    }

    const body = await request.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Invalid request.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const { token, password } = parsed.data;

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return apiError(passwordCheck.errors[0] ?? "Invalid password.", 400, "WEAK_PASSWORD");
    }

    const tokenLookup = hashLookupToken(token);
    const matchedToken = await PasswordResetToken.findOne({
      tokenLookup,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!matchedToken) {
      return apiError(
        "Invalid or expired reset link. Please request a new password reset.",
        400,
        "INVALID_TOKEN"
      );
    }

    const user = await User.findById(matchedToken.userId).select("+passwordHash");
    if (!user) {
      return apiError(
        "Invalid or expired reset link. Please request a new password reset.",
        400,
        "INVALID_TOKEN"
      );
    }

    user.passwordHash = await hashPassword(password);
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    matchedToken.usedAt = new Date();
    await matchedToken.save();

    await invalidateAllUserSessions(user._id.toString());

    await logAuthActivity({
      type: "PASSWORD_CHANGED",
      userId: user._id,
      ipAddress: ip,
      userAgent,
      metadata: { method: "reset" },
    });

    return apiSuccess({
      message: "Password updated successfully. You may now sign in with your new password.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
