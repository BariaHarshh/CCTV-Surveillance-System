import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { Postmortem, newEnterpriseId } from "@/models/Enterprise";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const postmortems = await Postmortem.find({}).sort({ createdAt: -1 }).limit(100).lean();
    return apiSuccess({ postmortems });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  platformIncidentId: z.string().min(1),
  summary: z.string().optional(),
  impact: z.string().optional(),
  rootCause: z.string().optional(),
  rootCauseVerified: z.boolean().optional(),
  timeline: z.array(z.record(z.string(), z.unknown())).optional(),
  resolution: z.string().optional(),
  preventiveActions: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const user = await requireSuperAdmin();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid postmortem.", 400, "VALIDATION_ERROR");

    const postmortem = await Postmortem.create({
      postmortemId: newEnterpriseId("pm"),
      platformIncidentId: parsed.data.platformIncidentId,
      summary: parsed.data.summary ?? "",
      impact: parsed.data.impact ?? "",
      rootCause: parsed.data.rootCause ?? "",
      rootCauseVerified: parsed.data.rootCauseVerified ?? false,
      timeline: parsed.data.timeline ?? [],
      resolution: parsed.data.resolution ?? "",
      preventiveActions: parsed.data.preventiveActions ?? [],
      owner: user._id,
    });
    return apiSuccess({ postmortem }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

const updateSchema = z.object({
  postmortemId: z.string().min(1),
  summary: z.string().optional(),
  impact: z.string().optional(),
  rootCause: z.string().optional(),
  rootCauseVerified: z.boolean().optional(),
  timeline: z.array(z.record(z.string(), z.unknown())).optional(),
  resolution: z.string().optional(),
  preventiveActions: z.array(z.string()).optional(),
  completedDate: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid postmortem update.", 400, "VALIDATION_ERROR");

    const postmortem = await Postmortem.findOne({ postmortemId: parsed.data.postmortemId });
    if (!postmortem) return apiError("Postmortem not found.", 404, "NOT_FOUND");

    if (parsed.data.summary != null) postmortem.summary = parsed.data.summary;
    if (parsed.data.impact != null) postmortem.impact = parsed.data.impact;
    if (parsed.data.rootCause != null) postmortem.rootCause = parsed.data.rootCause;
    if (parsed.data.rootCauseVerified != null) {
      postmortem.rootCauseVerified = parsed.data.rootCauseVerified;
    }
    if (parsed.data.timeline != null) postmortem.timeline = parsed.data.timeline;
    if (parsed.data.resolution != null) postmortem.resolution = parsed.data.resolution;
    if (parsed.data.preventiveActions != null) {
      postmortem.preventiveActions = parsed.data.preventiveActions;
    }
    if (parsed.data.completedDate !== undefined) {
      postmortem.completedDate = parsed.data.completedDate
        ? new Date(parsed.data.completedDate)
        : null;
    }
    await postmortem.save();
    return apiSuccess({ postmortem });
  } catch (error) {
    return handleApiError(error);
  }
}
