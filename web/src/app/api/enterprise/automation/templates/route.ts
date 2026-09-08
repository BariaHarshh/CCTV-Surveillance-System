import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";
import { AUTOMATION_TEMPLATES } from "@/lib/enterprise/constants";
import { Automation, newEnterpriseId } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    await requireOrgMember(["ADMIN"]);
    return apiSuccess({ templates: AUTOMATION_TEMPLATES });
  } catch (error) {
    return handleApiError(error);
  }
}

const installSchema = z.object({
  templateKey: z.string().min(1),
  name: z.string().min(2).max(120).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = installSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid template install.", 400, "VALIDATION_ERROR");

    const tpl = AUTOMATION_TEMPLATES.find((t) => t.key === parsed.data.templateKey);
    if (!tpl) return apiError("Unknown template.", 404, "NOT_FOUND");

    const automation = await Automation.create({
      automationId: newEnterpriseId("auto"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      name: parsed.data.name ?? tpl.name,
      description: tpl.description,
      status: "DRAFT",
      version: 1,
      trigger: { ...tpl.trigger },
      conditions: [],
      actions: tpl.actions.map((type) => ({ type })),
      templateKey: tpl.key,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent({
      actor: user,
      action: "AUTOMATION_CREATED",
      description: `${user.name} installed template ${tpl.key} as ${automation.automationId}`,
      request,
      targetType: "Automation",
      targetId: automation.automationId,
    });

    return apiSuccess({ automation }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
