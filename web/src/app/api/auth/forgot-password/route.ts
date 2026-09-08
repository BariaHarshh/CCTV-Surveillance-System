import { z } from "zod";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { logAuthActivity } from "@/lib/auth/activity";
import { hashLookupToken } from "@/lib/auth/token-lookup";
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { User } from "@/models/User";
import { PasswordResetToken } from "@/models/PasswordResetToken";

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

const GENERIC_MESSAGE =
  "If an account exists for this email, password reset instructions will be provided.";

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();

    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";

    const rateLimit = checkRateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return apiError("Too many requests. Please try again later.", 429, "RATE_LIMITED");
    }

    const body = await request.json();
    const parsed = forgotSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Invalid email.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await User.findOne({ email });

    if (user && user.status === "ACTIVE") {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenLookup = hashLookupToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await PasswordResetToken.updateMany(
        { userId: user._id, usedAt: null },
        { usedAt: new Date() }
      );

      await PasswordResetToken.create({
        userId: user._id,
        tokenLookup,
        expiresAt,
      });

      if (process.env.NODE_ENV === "development") {
        console.info(
          `[DEV] Password reset token for ${email}: ${rawToken}\n` +
            `Reset URL: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password?token=${rawToken}`
        );
      }

      await logAuthActivity({
        type: "PASSWORD_RESET_REQUEST",
        userId: user._id,
        ipAddress: ip,
        userAgent,
      });
    }

    return apiSuccess({ message: GENERIC_MESSAGE });
  } catch (error) {
    return handleApiError(error);
  }
}
