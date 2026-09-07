import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManagePlaybooks, canViewPlaybooks } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createPlaybook, listPlaybooks } from "@/lib/emergency/playbook-service";
import { logAuditEvent } from "@/lib/audit/log";
import { PLAYBOOK_CATEGORIES } from "@/lib/emergency/constants";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewPlaybooks(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const playbooks = await listPlaybooks(organizationId);
    return apiSuccess({ playbooks });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  name: z.string().min(2).max(100),
  category: z.enum(PLAYBOOK_CATEGORIES),
  description: z.string().max(1000).optional(),
  steps: z.array(z.object({ order: z.number().optional(), title: z.string(), description: z.string().optional() })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManagePlaybooks(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid playbook.", 400, "VALIDATION_ERROR");
    const playbook = await createPlaybook(organizationId, parsed.data, {
      id: user._id.toString(),
      name: user.name,
    });
    await logAuditEvent({
      actor: user,
      action: "PLAYBOOK_UPDATED",
      description: `${user.name} created playbook ${playbook.playbookId}`,
      request,
      targetType: "Playbook",
      targetId: playbook.id,
    });
    return apiSuccess({ playbook }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
