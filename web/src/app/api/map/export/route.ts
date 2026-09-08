import { requireOrgMember } from "@/lib/auth/require-org-member";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { canExportMap, canViewMap } from "@/lib/map/permissions";
import { getRiskHeatmap, getViewportObjects } from "@/lib/map/map-service";
import { getMapAnalytics } from "@/lib/map/zone-service";
import { logAuditEvent } from "@/lib/audit/log";
import { suggestEvacuationRoute } from "@/lib/map/routing";

export async function GET(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
    const url = new URL(request.url);
    if (url.searchParams.get("analytics") === "1") {
      const analytics = await getMapAnalytics(organizationId);
      return apiSuccess({ analytics });
    }
    return apiError("Specify ?analytics=1 or POST with action=export|route", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organizationId } = await requireOrgMember();
    const body = await request.json();
    const action = String(body.action || "export");

    if (action === "route") {
      if (!canViewMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      const result = suggestEvacuationRoute({
        start: body.start,
        destination: body.destination,
        nodes: body.nodes || [],
        edges: body.edges || [],
      });
      return apiSuccess({ route: result });
    }

    if (action === "export") {
      if (!canExportMap(user)) return apiError("Forbidden", 403, "FORBIDDEN");
      const format = String(body.format || "CSV").toUpperCase();
      const objects = await getViewportObjects(organizationId, user, {
        timeRange: body.timeRange || "7D",
        layers: body.layers,
      });
      const heatmap = await getRiskHeatmap(organizationId, { timeRange: "30D" });

      await logAuditEvent({
        actor: user,
        action: format === "CSV" ? "MAP_EXPORT" : "SENSITIVE_LOCATION_EXPORTED",
        description: `Exported map data as ${format}`,
        targetType: "Map",
        severity: "warning",
        metadata: { format, sensitive: Boolean(body.sensitive) },
      });

      if (format === "CSV") {
        const rows = [["kind", "id", "name", "lat", "lng", "status"]];
        const push = (kind: string, arr: unknown) => {
          const list = arr as Array<Record<string, unknown>> | undefined;
          if (!list) return;
          for (const item of list) {
            if (item.isCluster) continue;
            rows.push([
              kind,
              String(item.id ?? ""),
              String(item.name ?? ""),
              String(item.lat ?? ""),
              String(item.lng ?? ""),
              String(item.status ?? ""),
            ]);
          }
        };
        push("camera", objects.cameras);
        push("incident", objects.incidents);
        push("building", objects.buildings);
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        return apiSuccess({
          export: {
            format: "CSV",
            content: csv,
            filename: `map-export-${Date.now()}.csv`,
          },
        });
      }

      return apiSuccess({
        export: {
          format,
          payload: {
            generatedAt: new Date().toISOString(),
            riskAreas: heatmap.cells,
            summary: objects.accessibilityList,
          },
          note: "PNG/PDF map snapshots should be captured client-side from the rendered map.",
        },
      });
    }

    return apiError("Unknown action", 400, "VALIDATION");
  } catch (e) {
    return handleApiError(e);
  }
}
