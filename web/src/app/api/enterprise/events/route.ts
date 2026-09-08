import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { publishEnterpriseEvent } from "@/lib/enterprise/event-bus";
import { EnterpriseEvent } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const events = await EnterpriseEvent.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return apiSuccess({ events });
  } catch (error) {
    return handleApiError(error);
  }
}

const publishSchema = z.object({
  type: z.string().min(1).max(80),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  payloadReference: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = publishSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid event.", 400, "VALIDATION_ERROR");

    const event = await publishEnterpriseEvent({
      organizationId,
      type: parsed.data.type,
      source: "admin",
      resourceType: parsed.data.resourceType ?? null,
      resourceId: parsed.data.resourceId ?? null,
      payloadReference: parsed.data.payloadReference ?? {},
    });

    return apiSuccess({ event }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
