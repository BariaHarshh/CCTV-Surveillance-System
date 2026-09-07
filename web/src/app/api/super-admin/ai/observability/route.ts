import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { AIUsageRecord } from "@/models/Intelligence";
import { connectDB } from "@/lib/db/connect";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    await connectDB();

    const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days") ?? 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totals, byProvider, byOrg, recentErrors] = await Promise.all([
      AIUsageRecord.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            requests: { $sum: "$requests" },
            inputTokens: { $sum: "$inputTokens" },
            outputTokens: { $sum: "$outputTokens" },
            estimatedCostUsd: { $sum: "$estimatedCostUsd" },
            successCount: { $sum: { $cond: ["$success", 1, 0] } },
            failureCount: { $sum: { $cond: ["$success", 0, 1] } },
            avgLatencyMs: { $avg: "$latencyMs" },
          },
        },
      ]),
      AIUsageRecord.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: "$provider",
            requests: { $sum: "$requests" },
            failures: { $sum: { $cond: ["$success", 0, 1] } },
            avgLatencyMs: { $avg: "$latencyMs" },
          },
        },
        { $sort: { requests: -1 } },
      ]),
      AIUsageRecord.aggregate([
        { $match: { createdAt: { $gte: since }, organizationId: { $ne: null } } },
        {
          $group: {
            _id: "$organizationId",
            requests: { $sum: "$requests" },
            estimatedCostUsd: { $sum: "$estimatedCostUsd" },
          },
        },
        { $sort: { requests: -1 } },
        { $limit: 25 },
      ]),
      AIUsageRecord.find({ createdAt: { $gte: since }, success: false })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("provider model error createdAt organizationId toolsUsed")
        .lean(),
    ]);

    const t = totals[0] ?? {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      successCount: 0,
      failureCount: 0,
      avgLatencyMs: 0,
    };

    return apiSuccess({
      rangeDays: days,
      totals: {
        requests: t.requests ?? 0,
        inputTokens: t.inputTokens ?? 0,
        outputTokens: t.outputTokens ?? 0,
        estimatedCostUsd: Math.round((t.estimatedCostUsd ?? 0) * 1e6) / 1e6,
        successCount: t.successCount ?? 0,
        failureCount: t.failureCount ?? 0,
        avgLatencyMs: Math.round(t.avgLatencyMs ?? 0),
      },
      byProvider: byProvider.map((p) => ({
        provider: p._id,
        requests: p.requests,
        failures: p.failures,
        avgLatencyMs: Math.round(p.avgLatencyMs ?? 0),
      })),
      byOrganization: byOrg.map((o) => ({
        organizationId: String(o._id),
        requests: o.requests,
        estimatedCostUsd: Math.round((o.estimatedCostUsd ?? 0) * 1e6) / 1e6,
      })),
      recentErrors: recentErrors.map((e) => ({
        provider: e.provider,
        model: e.model,
        error: e.error,
        toolsUsed: e.toolsUsed,
        organizationId: e.organizationId ? String(e.organizationId) : null,
        createdAt: e.createdAt,
      })),
      asOf: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
