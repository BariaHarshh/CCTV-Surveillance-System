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
    const agents = await AgentRegistry.find({}).sort({ name: 1 }).lean();
    return apiSuccess({ agents });
  } catch (error) {
    return handleApiError(error);
  }
}
