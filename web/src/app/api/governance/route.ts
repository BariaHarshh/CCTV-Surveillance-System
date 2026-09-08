import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canViewExecutive } from "@/lib/analytics/permissions";
import {
  getGovernanceCenter,
  listDecisions,
  createDecision,
  listInitiatives,
  createInitiative,
  createPolicyException,
  getAccessGovernance,
  getAuditIntelligence,
  getSecurityGovernance,
  createAfterAction,
  ensureDataCategories,
  listReportSchedules,
  createReportSchedule,
} from "@/lib/bi/governance-service";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewExecutive(user) && user.role !== "ADMIN") {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "center";

    await logAuditEvent({
      actor: user,
      action: "GOVERNANCE_VIEWED",
      description: `Governance view=${view}`,
    });

    if (view === "center") return apiSuccess(await getGovernanceCenter(organizationId));
    if (view === "decisions") return apiSuccess({ decisions: await listDecisions(organizationId) });
    if (view === "strategy") return apiSuccess({ initiatives: await listInitiatives(organizationId) });
    if (view === "access") return apiSuccess(await getAccessGovernance(organizationId));
    if (view === "audit") {
      return apiSuccess(await getAuditIntelligence(organizationId, url.searchParams.get("q") || undefined));
    }
    if (view === "security") return apiSuccess(await getSecurityGovernance(organizationId));
    if (view === "data") {
      await ensureDataCategories(organizationId);
      const center = await getGovernanceCenter(organizationId);
      return apiSuccess({ dataCategories: center.dataCategories, legalHolds: center.legalHolds });
    }
    if (view === "schedules") return apiSuccess({ schedules: await listReportSchedules(organizationId) });
    return apiError("Unknown view", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && !canViewExecutive(user)) {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "decision") {
      const result = await createDecision(organizationId, user, body);
      return apiSuccess(result, 201);
    }
    if (action === "initiative") {
      const row = await createInitiative(organizationId, user, body);
      return apiSuccess({ initiativeId: row.initiativeId }, 201);
    }
    if (action === "exception") {
      const row = await createPolicyException(organizationId, user, body);
      return apiSuccess({ exceptionId: row.exceptionId }, 201);
    }
    if (action === "after_action") {
      const row = await createAfterAction(organizationId, user, body);
      return apiSuccess({ reviewId: row.reviewId }, 201);
    }
    if (action === "schedule_report") {
      const row = await createReportSchedule(organizationId, user, body);
      await logAuditEvent({
        actor: user,
        action: "REPORT_SCHEDULE_CREATED",
        description: row.scheduleId,
      });
      return apiSuccess({ scheduleId: row.scheduleId }, 201);
    }
    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
