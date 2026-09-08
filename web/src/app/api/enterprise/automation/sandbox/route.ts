import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { simulateAutomation } from "@/lib/enterprise/workflow-engine";

const schema = z.object({
  automationId: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid sandbox request.", 400, "VALIDATION_ERROR");

    const result = await simulateAutomation(
      organizationId,
      parsed.data.automationId,
      parsed.data.context ?? { eventType: "ALERT_CREATED", severity: "HIGH" }
    );
    return apiSuccess({ dryRun: true, result });
  } catch (error) {
    return handleApiError(error);
  }
}
