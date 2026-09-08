import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAuditEvent } from "@/lib/audit/log";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { organizationCreateSchema } from "@/lib/organizations/schemas";
import {
  createOrganization,
  listOrganizations,
  getOrganizationStats,
} from "@/lib/organizations/service";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const statsOnly = params.stats === "true";

    if (statsOnly) {
      const stats = await getOrganizationStats();
      return apiSuccess({ stats });
    }

    const result = await listOrganizations({
      q: params.q,
      status: params.status,
      type: params.type,
      page: params.page ? parseInt(params.page, 10) : 1,
      limit: params.limit ? parseInt(params.limit, 10) : 20,
      sort: params.sort,
      order: params.order as "asc" | "desc" | undefined,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const actor = await requireSuperAdmin();

    const body = await request.json();
    const parsed = organizationCreateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid data.", 400, "VALIDATION_ERROR");
    }

    const org = await createOrganization(parsed.data);

    await logAuditEvent({
      actor,
      action: "ORGANIZATION_CREATED",
      description: `Created organization: ${org.basicInformation.name}`,
      request,
      targetType: "organization",
      targetId: org._id,
      targetLabel: org.basicInformation.name,
      metadata: { organizationId: org.organizationId },
    });

    return apiSuccess({
      organization: {
        id: org._id.toString(),
        organizationId: org.organizationId,
        name: org.basicInformation.name,
        status: org.status,
        createdAt: org.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
