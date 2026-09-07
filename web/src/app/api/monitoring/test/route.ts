import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isTestModeEnabled } from "@/lib/monitoring/internal-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { processDetection } from "@/lib/ai/detection-service";
import { updateCameraStatus } from "@/lib/campus/camera-service";
import { broadcastCameraStatus, broadcastEmergencyCreated } from "@/lib/monitoring/socket-emitter";
import { MODULE_TO_EVENT } from "@/lib/ai/constants";
import { activateEmergency, updateEmergencyStatus } from "@/lib/emergency/emergency-service";
import { startEscalation, acknowledgeEscalation, getActiveEscalations } from "@/lib/emergency/escalation-engine";
import { createResponseTeam, listResponseTeams } from "@/lib/emergency/team-service";
import { createTask } from "@/lib/emergency/task-service";
import type { AIModuleType } from "@/lib/ai/constants";

const TEST_ACTIONS = [
  "test_event",
  "test_critical_alert",
  "camera_online",
  "camera_offline",
  "test_person",
  "test_occupancy",
  "test_restricted_entry",
  "test_after_hours",
  "test_abandoned_object",
  "test_fire",
  "test_smoke",
  "test_ppe",
  "test_tamper",
  "test_full_chain",
  "test_emergency",
  "test_escalation",
  "test_team_assignment",
  "test_task",
  "test_websocket_emergency",
  "test_emergency_resolve",
] as const;

const schema = z.object({
  action: z.enum(TEST_ACTIONS),
  cameraId: z.string().optional(),
  zoneId: z.string().optional(),
  emergencyId: z.string().optional(),
});

const ACTION_MODULE: Partial<Record<(typeof TEST_ACTIONS)[number], AIModuleType>> = {
  test_person: "PERSON_DETECTION",
  test_occupancy: "OCCUPANCY_DETECTION",
  test_restricted_entry: "RESTRICTED_ZONE",
  test_after_hours: "AFTER_HOURS",
  test_abandoned_object: "ABANDONED_OBJECT",
  test_fire: "FIRE_DETECTION",
  test_smoke: "SMOKE_DETECTION",
  test_ppe: "PPE_DETECTION",
  test_tamper: "CAMERA_TAMPER",
};

export async function POST(request: NextRequest) {
  try {
    if (!isTestModeEnabled()) return apiError("Test mode unavailable.", 403, "FORBIDDEN");

    await ensureDbReady();
    const { user, organizationId } = await requireAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("Invalid test action.", 400, "VALIDATION_ERROR");


    const { action, cameraId, zoneId, emergencyId } = parsed.data;
    const actor = { id: user._id.toString(), name: user.name };

    if (action === "test_emergency") {
      const emergency = await activateEmergency({
        organizationId,
        type: "SECURITY",
        reason: "TEST: Simulated security emergency",
        description: "Development test emergency — source TEST",
        location: { label: "Test Building A" },
        actor,
        source: "TEST",
        severity: "CRITICAL",
        mode: "EMERGENCY",
      });
      await startEscalation({ organizationId, emergencyId: emergency.id, severity: "CRITICAL", source: "TEST" });
      return apiSuccess({ emergency, source: "TEST", simulated: true }, 201);
    }

    if (action === "test_escalation") {
      let eid = emergencyId;
      if (!eid) {
        const emergency = await activateEmergency({
          organizationId,
          type: "INTRUSION",
          reason: "TEST: Escalation simulation",
          actor,
          source: "TEST",
          severity: "HIGH",
        });
        eid = emergency.id;
      }
      const esc = await startEscalation({ organizationId, emergencyId: eid, severity: "HIGH", source: "TEST" });
      return apiSuccess({ escalation: esc, emergencyId: eid, source: "TEST", simulated: true }, 201);
    }

    if (action === "test_team_assignment") {
      const teams = await listResponseTeams(organizationId);
      let team = teams[0];
      if (!team) {
        team = await createResponseTeam(organizationId, { name: "TEST Security Team", type: "SECURITY", source: "TEST" });
      }
      const emergency = await activateEmergency({
        organizationId,
        type: "SECURITY",
        reason: "TEST: Team assignment",
        actor,
        source: "TEST",
        teamIds: [team.id],
      });
      return apiSuccess({ emergency, team, source: "TEST", simulated: true }, 201);
    }

    if (action === "test_task") {
      let eid = emergencyId;
      if (!eid) {
        const emergency = await activateEmergency({
          organizationId,
          type: "OTHER",
          reason: "TEST: Task simulation",
          actor,
          source: "TEST",
        });
        eid = emergency.id;
      }
      const task = await createTask(
        organizationId,
        { title: "TEST: Verify location", emergencyId: eid, source: "TEST", priority: "HIGH" },
        actor
      );
      return apiSuccess({ task, emergencyId: eid, source: "TEST", simulated: true }, 201);
    }

    if (action === "test_websocket_emergency") {
      const emergency = await activateEmergency({
        organizationId,
        type: "CAMPUS_THREAT",
        reason: "TEST: WebSocket broadcast",
        actor,
        source: "TEST",
      });
      broadcastEmergencyCreated(organizationId, { ...emergency, websocketTest: true });
      return apiSuccess({ emergency, source: "TEST", simulated: true, websocket: "emitted" }, 201);
    }

    if (action === "test_emergency_resolve") {
      let eid = emergencyId;
      if (!eid) {
        const emergency = await activateEmergency({
          organizationId,
          type: "OTHER",
          reason: "TEST: Resolve simulation",
          actor,
          source: "TEST",
        });
        eid = emergency.id;
        const esc = await startEscalation({ organizationId, emergencyId: eid, severity: "MEDIUM", source: "TEST" });
        if (esc) await acknowledgeEscalation(organizationId, esc.id, actor);
      }
      const result = await updateEmergencyStatus(organizationId, eid, "RESOLVED", actor, "TEST resolution");
      const remaining = await getActiveEscalations(organizationId, eid);
      return apiSuccess({ result, escalations: remaining, source: "TEST", simulated: true });
    }

    if (!cameraId && action !== "camera_online" && action !== "camera_offline") {
      return apiError("cameraId required.", 400, "VALIDATION_ERROR");
    }

    if (action === "camera_online" || action === "camera_offline") {
      if (!cameraId) return apiError("cameraId required.", 400, "VALIDATION_ERROR");
      const status = action === "camera_online" ? "ONLINE" : "OFFLINE";
      const cam = await updateCameraStatus(organizationId, cameraId, status);
      if (!cam) return apiError("Camera not found.", 404, "NOT_FOUND");
      broadcastCameraStatus(organizationId, {
        cameraId: cam.cameraId,
        status: cam.status,
        timestamp: new Date().toISOString(),
        lastSeen: cam.lastSeen,
      });
      return apiSuccess({ camera: cam, source: "TEST" });
    }

    if (action === "test_event" || action === "test_critical_alert") {
      const result = await processDetection({
        organizationId,
        cameraId: cameraId!,
        moduleType: action === "test_critical_alert" ? "RESTRICTED_ZONE" : "PERSON_DETECTION",
        source: "TEST",
        confidence: action === "test_critical_alert" ? 0.92 : 0.65,
        skipDedup: true,
        metadata: {
          eventType: action === "test_critical_alert" ? "UNAUTHORIZED_ENTRY" : "PERSON_DETECTED",
          zoneId,
          testMode: true,
          triggeredBy: user.userId,
          simulated: true,
        },
      });
      return apiSuccess({ ...result, source: "TEST", simulated: true }, 201);
    }

    if (action === "test_full_chain") {
      const result = await processDetection({
        organizationId,
        cameraId: cameraId!,
        moduleType: "RESTRICTED_ZONE",
        source: "TEST",
        confidence: 0.94,
        skipDedup: true,
        metadata: {
          eventType: "UNAUTHORIZED_ENTRY",
          zoneId,
          zoneName: "Test Restricted Zone",
          testMode: true,
          triggeredBy: user.userId,
          simulated: true,
        },
      });
      return apiSuccess({ ...result, source: "TEST", simulated: true, chain: "detection→event→risk→alert→incident" }, 201);
    }

    const moduleType = ACTION_MODULE[action];
    if (!moduleType) return apiError("Unknown action.", 400, "VALIDATION_ERROR");

    const metadata: Record<string, unknown> = {
      eventType: MODULE_TO_EVENT[moduleType],
      testMode: true,
      triggeredBy: user.userId,
      simulated: true,
    };

    if (action === "test_person") metadata.boundingBox = { x: 0.2, y: 0.3, w: 0.15, h: 0.4 };
    if (action === "test_occupancy") { metadata.currentCount = 45; metadata.capacity = 50; }
    if (action === "test_restricted_entry") { metadata.zoneId = zoneId; metadata.zoneName = "Test Zone"; }
    if (action === "test_abandoned_object") { metadata.objectType = "bag"; metadata.firstSeen = new Date().toISOString(); }
    if (action === "test_ppe") metadata.missingEquipment = "helmet";
    if (action === "test_tamper") metadata.tamperType = "obstruction";

    const result = await processDetection({
      organizationId,
      cameraId: cameraId!,
      moduleType,
      source: "TEST",
      confidence: 0.88,
      skipDedup: true,
      metadata,
    });

    return apiSuccess({ ...result, source: "TEST", simulated: true }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
