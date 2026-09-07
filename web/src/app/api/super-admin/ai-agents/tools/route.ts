import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { ensureDefaultAgents } from "@/lib/enterprise/agent-service";
import { AgentRegistry } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    await ensureDefaultAgents();
    const agents = await AgentRegistry.find({}).lean();
    const tools = agents.flatMap((a) =>
      (a.tools ?? []).map((tool) => ({
        agentId: a.agentId,
        agentName: a.name,
        tool,
        actionMode: a.actionMode,
        riskLevel: a.riskLevel,
        status: a.status,
      }))
    );
    return apiSuccess({ tools });
  } catch (error) {
    return handleApiError(error);
  }
}
