import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { FORBIDDEN_AUTOMATION_ACTIONS } from "@/lib/enterprise/constants";
import { Automation, AutomationVersion } from "@/models/Enterprise";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const { id } = await ctx.params;
    const automation = await Automation.findOne({
      automationId: id,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    }).lean();
    if (!automation) return apiError("Automation not found.", 404, "NOT_FOUND");
    const versions = await AutomationVersion.find({ automationId: id })
      .sort({ version: -1 })
      .limit(20)
      .lean();
    return apiSuccess({ automation, versions });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "DISABLED"]).optional(),
  trigger: z.record(z.string(), z.unknown()).optional(),
  conditions: z.array(z.record(z.string(), z.unknown())).optional(),
  actions: z.array(z.record(z.string(), z.unknown())).optional(),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN"]);
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid update.", 400, "VALIDATION_ERROR");

    const automation = await Automation.findOne({
      automationId: id,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
    if (!automation) return apiError("Automation not found.", 404, "NOT_FOUND");

    if (parsed.data.actions) {
      for (const a of parsed.data.actions) {
        const type = String(a.type ?? a.action ?? "");
        if (FORBIDDEN_AUTOMATION_ACTIONS.includes(type as never)) {
          return apiError(`Forbidden automation action: ${type}`, 400, "FORBIDDEN_ACTION");
        }
      }
      automation.actions = parsed.data.actions;
    }
    if (parsed.data.name != null) automation.name = parsed.data.name;
    if (parsed.data.description != null) automation.description = parsed.data.description;
    if (parsed.data.trigger != null) automation.trigger = parsed.data.trigger;
    if (parsed.data.conditions != null) automation.conditions = parsed.data.conditions;

    const publishing =
      parsed.data.status === "ACTIVE" && automation.status !== "ACTIVE";
    if (parsed.data.status != null) automation.status = parsed.data.status;

    if (publishing) {
      automation.version += 1;
      await AutomationVersion.create({
        automationId: automation.automationId,
        organizationId: automation.organizationId,
        version: automation.version,
        snapshot: {
          name: automation.name,
          description: automation.description,
          trigger: automation.trigger,
          conditions: automation.conditions,
          actions: automation.actions,
          status: automation.status,
        },
        createdBy: user._id,
      });
    }

    automation.updatedBy = user._id as mongoose.Types.ObjectId;
    await automation.save();
    return apiSuccess({ automation });
  } catch (error) {
    return handleApiError(error);
  }
}
