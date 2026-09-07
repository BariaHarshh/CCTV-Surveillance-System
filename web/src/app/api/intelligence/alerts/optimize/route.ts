import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { Alert } from "@/models/Alert";
import { orgFilter } from "@/lib/campus/service";

/** Alert optimization recommendations — never auto-disables critical alerts. */
export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember();
    await connectDB();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const alerts = await Alert.find(orgFilter(organizationId, { createdAt: { $gte: since } }))
      .select("title severity status")
      .limit(500)
      .lean();

    const byTitle = new Map<string, number>();
    let critical = 0;
    for (const a of alerts) {
      const title = String((a as { title?: string }).title ?? "untitled");
      byTitle.set(title, (byTitle.get(title) ?? 0) + 1);
      if ((a as { severity?: string }).severity === "CRITICAL") critical += 1;
    }
    const duplicates = [...byTitle.entries()]
      .filter(([, n]) => n >= 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([title, count]) => ({ title, count }));

    return apiSuccess({
      analysis: {
        totalAlerts30d: alerts.length,
        criticalCount: critical,
        possibleDuplicates: duplicates,
        recommendations: [
          ...(duplicates.length
            ? [
                {
                  priority: "MEDIUM",
                  text: "Repeated alert titles may indicate duplicate or low-value rules. Review carefully.",
                  evidence: `${duplicates.length} titles repeated ≥5 times.`,
                },
              ]
            : []),
          {
            priority: "CRITICAL",
            text: "Do not automatically disable critical safety alerts.",
            evidence: `${critical} critical alerts in 30 days.`,
          },
        ],
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
