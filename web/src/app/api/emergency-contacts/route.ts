import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canManageContacts, canViewContacts } from "@/lib/emergency/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createContact, listContacts } from "@/lib/emergency/contact-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewContacts(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const contacts = await listContacts(organizationId);
    return apiSuccess({ contacts });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  name: z.string().min(2),
  department: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  availability: z.string().optional(),
  priority: z.number().min(1).max(10).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canManageContacts(user)) return apiError("Permission denied.", 403, "FORBIDDEN");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid contact.", 400, "VALIDATION_ERROR");
    const contact = await createContact(organizationId, parsed.data);
    await logAuditEvent({
      actor: user,
      action: "EMERGENCY_CONTACT_UPDATED",
      description: `${user.name} created emergency contact ${contact.contactId}`,
      request,
      targetType: "EmergencyContact",
      targetId: contact.id,
    });
    return apiSuccess({ contact }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
