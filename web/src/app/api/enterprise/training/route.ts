import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { TrainingDrill, newEnterpriseId } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const drills = await TrainingDrill.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .sort({ date: -1 })
      .limit(100)
      .lean();
    return apiSuccess({ drills });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.string().optional(),
  date: z.string().datetime().or(z.string().min(4)),
  location: z.string().optional(),
  participants: z.array(z.string()).optional(),
  objective: z.string().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
  responseTimeMinutes: z.number().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid training drill.", 400, "VALIDATION_ERROR");

    const drill = await TrainingDrill.create({
      drillId: newEnterpriseId("drl"),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      name: parsed.data.name,
      type: parsed.data.type ?? "SAFETY_DRILL",
      date: new Date(parsed.data.date),
      location: parsed.data.location ?? "",
      participants: parsed.data.participants ?? [],
      objective: parsed.data.objective ?? "",
      result: parsed.data.result ?? "",
      notes: parsed.data.notes ?? "",
      responseTimeMinutes: parsed.data.responseTimeMinutes ?? null,
      createdBy: user._id,
    });
    return apiSuccess({ drill }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

const updateSchema = z.object({
  drillId: z.string().min(1),
  name: z.string().min(2).max(200).optional(),
  type: z.string().optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  participants: z.array(z.string()).optional(),
  objective: z.string().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
  responseTimeMinutes: z.number().nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireOrgMember(["ADMIN"]);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid drill update.", 400, "VALIDATION_ERROR");

    const drill = await TrainingDrill.findOne({
      drillId: parsed.data.drillId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
    if (!drill) return apiError("Drill not found.", 404, "NOT_FOUND");

    if (parsed.data.name != null) drill.name = parsed.data.name;
    if (parsed.data.type != null) drill.type = parsed.data.type;
    if (parsed.data.date != null) drill.date = new Date(parsed.data.date);
    if (parsed.data.location != null) drill.location = parsed.data.location;
    if (parsed.data.participants != null) drill.participants = parsed.data.participants;
    if (parsed.data.objective != null) drill.objective = parsed.data.objective;
    if (parsed.data.result != null) drill.result = parsed.data.result;
    if (parsed.data.notes != null) drill.notes = parsed.data.notes;
    if (parsed.data.responseTimeMinutes !== undefined) {
      drill.responseTimeMinutes = parsed.data.responseTimeMinutes;
    }
    await drill.save();
    return apiSuccess({ drill });
  } catch (error) {
    return handleApiError(error);
  }
}
