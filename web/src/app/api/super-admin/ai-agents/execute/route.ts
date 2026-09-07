import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { executeAgentTool } from "@/lib/enterprise/agent-service";

const schema = z.object({
  organizationId: z.string().min(1),
  agentId: z.string().min(1),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
  requestSummary: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const user = await requireSuperAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid execute request.", 400, "VALIDATION_ERROR");

    const result = await executeAgentTool({
      organizationId: parsed.data.organizationId,
      user,
      agentId: parsed.data.agentId,
      tool: parsed.data.tool,
      args: parsed.data.args,
      requestSummary: parsed.data.requestSummary,
    });
    return apiSuccess({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
