import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";
import { AUTOMATION_TEMPLATES, FORBIDDEN_AUTOMATION_ACTIONS } from "@/lib/enterprise/constants";
import { Automation, newEnterpriseId } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const automations = await Automation.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .sort({ updatedAt: -1 })
      .lean();
    return apiSuccess({ automations });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  templateKey: z.string().optional(),
  trigger: z.record(z.string(), z.unknown()).optional(),
  conditions: z.array(z.record(z.string(), z.unknown())).optional(),
  actions: z.array(z.record(z.string(), z.unknown())).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid automation.", 400, "VALIDATION_ERROR");

    let trigger = parsed.data.trigger ?? { type: "EVENT", event: "ALERT_CREATED" };
    let actions = parsed.data.actions ?? [{ type: "AUDIT" }];
    let name = parsed.data.name;
    let description = parsed.data.description ?? "";
    let templateKey: string | null = parsed.data.templateKey ?? null;

    if (parsed.data.templateKey) {
      const tpl = AUTOMATION_TEMPLATES.find((t) => t.key === parsed.data.templateKey);
      if (!tpl) return apiError("Unknown template.", 400, "VALIDATION_ERROR");
      trigger = { ...tpl.trigger };
      actions = tpl.actions.map((type) => ({ type }));
      name = parsed.data.name || tpl.name;
      description = parsed.data.description ?? tpl.description;
      templateKey = tpl.key;
    }

    for (const a of actions) {
      const type = String(a.type ?? a.action ?? "");
      if (FORBIDDEN_AUTOMATION_ACTIONS.includes(type as never)) {
        return apiError(`Forbidden automation action: ${type}`, 400, "FORBIDDEN_ACTION");
      }
    }

    const automation = await Automation.create({
      automationId: newEnterpriseId("auto"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      name,
      description,
      status: "DRAFT",
      version: 1,
      trigger,
      conditions: parsed.data.conditions ?? [],
      actions,
      templateKey,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent({
      actor: user,
      action: "AUTOMATION_CREATED",
      description: `${user.name} created automation ${automation.automationId}`,
      request,
      targetType: "Automation",
      targetId: automation.automationId,
    });

    return apiSuccess({ automation }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
