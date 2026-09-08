import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { PlatformIncident } from "@/models/Platform";
import { getNextSequence } from "@/models/Counter";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    await ensureDbReady();
    await requireSuperAdmin();
    const items = await PlatformIncident.find().sort({ createdAt: -1 }).limit(50).lean();
    return apiSuccess({ incidents: items.map((i) => ({ id: i._id.toString(), incidentId: i.incidentId, severity: i.severity, type: i.type, status: i.status, description: i.description, detectedAt: i.detectedAt.toISOString() })) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();
    const user = await requireSuperAdmin();
    const body = await request.json();
    if (!body.description || !body.type || !body.severity) return apiError("Invalid incident.", 400, "VALIDATION_ERROR");
    const seq = await getNextSequence("platformincident");
    const doc = await PlatformIncident.create({
      incidentId: `PINC-${String(seq).padStart(6, "0")}`,
      severity: body.severity,
      type: body.type,
      status: "OPEN",
      affectedServices: body.affectedServices ?? [],
      description: body.description,
      owner: user.name,
    });
    await logAuditEvent({ actor: user, action: "PLATFORM_INCIDENT_CREATED", description: `${user.name} created platform incident ${doc.incidentId}`, request });
    return apiSuccess({ incident: { id: doc._id.toString(), incidentId: doc.incidentId } }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
