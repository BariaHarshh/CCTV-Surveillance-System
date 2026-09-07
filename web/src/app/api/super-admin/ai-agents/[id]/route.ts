import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { killSwitchAgent } from "@/lib/enterprise/agent-service";
import { AI_ACTION_MODES } from "@/lib/enterprise/constants";
import { AgentRegistry } from "@/models/Enterprise";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  killSwitch: z.boolean().optional(),
  reason: z.string().max(500).optional(),
  actionMode: z.enum(AI_ACTION_MODES).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "DISABLED", "TESTING"]).optional(),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await ensureDbReady();
    const user = await requireSuperAdmin();
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid agent update.", 400, "VALIDATION_ERROR");

    if (parsed.data.killSwitch) {
      const agent = await killSwitchAgent({
        agentId: id,
        user,
        reason: parsed.data.reason ?? "Kill switch activated by super admin",
      });
      return apiSuccess({ agent });
    }

    const agent = await AgentRegistry.findOne({ agentId: id });
    if (!agent) return apiError("Agent not found.", 404, "NOT_FOUND");

    if (parsed.data.actionMode != null) {
      // Never silently enable autonomous high-impact writes from UI defaults
      if (parsed.data.actionMode === "AUTONOMOUS" && agent.riskLevel === "CRITICAL") {
        return apiError("Cannot set CRITICAL agents to AUTONOMOUS.", 400, "FORBIDDEN_MODE");
      }
      agent.actionMode = parsed.data.actionMode;
    }
    if (parsed.data.status != null) {
      agent.status = parsed.data.status;
      if (parsed.data.status === "ACTIVE") {
        agent.disabledReason = null;
        agent.disabledBy = null;
        agent.disabledAt = null;
      }
    }
    await agent.save();
    return apiSuccess({ agent });
  } catch (error) {
    return handleApiError(error);
  }
}
