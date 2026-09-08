import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { createDepartment, listDepartments } from "@/lib/platform/settings-service";

export async function GET() {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    return apiSuccess({ departments: await listDepartments(organizationId) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const { organizationId } = await requireAdmin();
    const body = await request.json();
    if (!body.name) return apiError("name required.", 400, "VALIDATION_ERROR");
    const department = await createDepartment(organizationId, body.name, body.description);
    return apiSuccess({ department }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
