import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { AgentTrace } from "@/models/Enterprise";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const agentId = request.nextUrl.searchParams.get("agentId");
    const filter = agentId ? { agentId } : {};
    const traces = await AgentTrace.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return apiSuccess({ traces });
  } catch (error) {
    return handleApiError(error);
  }
}
