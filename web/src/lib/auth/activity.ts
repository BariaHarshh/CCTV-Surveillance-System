import { AuthActivity } from "@/models/AuthActivity";
import type { AuthActivityType } from "@/lib/auth/config";
import type { Types } from "mongoose";

interface LogActivityParams {
  type: AuthActivityType;
  userId?: Types.ObjectId | string | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuthActivity({
  type,
  userId = null,
  ipAddress = "unknown",
  userAgent = "",
  metadata = {},
}: LogActivityParams): Promise<void> {
  try {
    await AuthActivity.create({
      userId: userId ?? null,
      type,
      ipAddress,
      userAgent,
      metadata,
    });
  } catch {
    // Activity logging should not block auth flows
  }
}
