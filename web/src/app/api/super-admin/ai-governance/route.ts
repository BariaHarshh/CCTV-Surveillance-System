import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { ensureDefaultAgents } from "@/lib/enterprise/agent-service";
import { AgentRegistry, AgentTrace, ApprovalRequest } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    await ensureDefaultAgents();

    const [agents, traces, pendingApprovals, denials, waiting] = await Promise.all([
      AgentRegistry.find({}).lean(),
      AgentTrace.find({}).sort({ createdAt: -1 }).limit(50).lean(),
      ApprovalRequest.countDocuments({ status: "PENDING", requestedByType: "AI" }),
      AgentTrace.countDocuments({ outcome: "DENIED" }),
      AgentTrace.countDocuments({ outcome: "WAITING_APPROVAL" }),
    ]);

    return apiSuccess({
      governance: {
        agentsTotal: agents.length,
        agentsActive: agents.filter((a) => a.status === "ACTIVE").length,
        agentsDisabled: agents.filter((a) => a.status === "DISABLED").length,
        pendingAiApprovals: pendingApprovals,
        denials,
        waitingApproval: waiting,
      },
      agents,
      recentTraces: traces,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
