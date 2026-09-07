import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManagePlaybooks } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { duplicatePlaybook, updatePlaybook } from "@/lib/emergency/playbook-service";
import { logAuditEvent } from "@/lib/audit/log";
import { PLAYBOOK_CATEGORIES } from "@/lib/emergency/constants";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().optional(),
  category: z.enum(PLAYBOOK_CATEGORIES).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  duplicate: z.boolean().optional(),
  steps: z.array(z.object({ order: z.number(), title: z.string(), description: z.string().optional() })).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManagePlaybooks(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");
    const actor = { id: user._id.toString(), name: user.name };

    if (parsed.data.duplicate) {
      const playbook = await duplicatePlaybook(organizationId, id, actor);
      if (!playbook) return apiError("Playbook not found.", 404, "NOT_FOUND");
      await logAuditEvent({
        actor: user,
        action: "PLAYBOOK_UPDATED",
        description: `${user.name} duplicated playbook ${id}`,
        request,
        targetType: "Playbook",
        targetId: playbook.id,
      });
      return apiSuccess({ playbook }, 201);
    }

    const playbook = await updatePlaybook(organizationId, id, parsed.data, actor);
    if (!playbook) return apiError("Playbook not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "PLAYBOOK_UPDATED",
      description: `${user.name} updated playbook ${id}`,
      request,
      targetType: "Playbook",
      targetId: id,
    });
    return apiSuccess({ playbook });
  } catch (error) {
    return handleApiError(error);
  }
}
