import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageContacts } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateContact } from "@/lib/emergency/contact-service";
import { logAuditEvent } from "@/lib/audit/log";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().optional(),
  department: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  availability: z.string().optional(),
  priority: z.number().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageContacts(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");
    const contact = await updateContact(organizationId, id, parsed.data);
    if (!contact) return apiError("Contact not found.", 404, "NOT_FOUND");
    await logAuditEvent({
      actor: user,
      action: "EMERGENCY_CONTACT_UPDATED",
      description: `${user.name} updated emergency contact ${id}`,
      request,
      targetType: "EmergencyContact",
      targetId: id,
    });
    return apiSuccess({ contact });
  } catch (error) {
    return handleApiError(error);
  }
}
