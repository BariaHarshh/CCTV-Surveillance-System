import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { FeatureFlag } from "@/models/Platform";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const flags = await FeatureFlag.find().sort({ key: 1 }).lean();
    return apiSuccess({ flags: flags.map((f) => ({ id: f._id.toString(), key: f.key, enabled: f.enabled, environment: f.environment, rolloutPercentage: f.rolloutPercentage })) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const user = await requireSuperAdmin();
    const body = await request.json();
    if (!body.key) return apiError("key required.", 400, "VALIDATION_ERROR");
    const flag = await FeatureFlag.findOneAndUpdate(
      { key: body.key },
      { $set: { enabled: Boolean(body.enabled), environment: body.environment ?? "all", rolloutPercentage: body.rolloutPercentage ?? 100 } },
      { upsert: true, new: true }
    );
    await logAuditEvent({ actor: user, action: "FEATURE_FLAG_UPDATED", description: `${user.name} updated flag ${body.key}`, request });
    return apiSuccess({ flag: { key: flag.key, enabled: flag.enabled } });
  } catch (error) {
    return handleApiError(error);
  }
}
