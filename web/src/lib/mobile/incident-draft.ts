import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { createOrUpdateIncident } from "@/lib/ai/incident-service";
import { Event } from "@/models/Event";
import { orgFilter } from "@/lib/campus/service";
import { getNextSequence, formatEventId } from "@/models/Counter";
import type { SeverityLevel } from "@/lib/monitoring/constants";

/**
 * Sync a field incident draft created offline.
 * Creates a real Event + Incident path — never fabricates evidence bytes.
 */
export async function createIncidentDraftFromSync(
  organizationId: string,
  user: { _id: mongoose.Types.ObjectId; name: string },
  payload: Record<string, unknown>
) {
  await connectDB();
  const clientDraftId = String(payload.clientDraftId || "");
  if (clientDraftId) {
    const existing = await Event.findOne(
      orgFilter(organizationId, { "metadata.clientDraftId": clientDraftId })
    );
    if (existing) {
      return {
        conflict: true as const,
        reason: "Draft already synced on server",
        incidentId: null as string | null,
        eventId: existing._id.toString(),
      };
    }
  }

  const building = String(payload.building || payload.location || "");
  const severity = (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(payload.severity))
    ? String(payload.severity)
    : "MEDIUM") as SeverityLevel;

  const seq = await getNextSequence("event");
  const event = await Event.create({
    eventId: await formatEventId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    eventType: "OTHER",
    source: "MANUAL",
    severity,
    locationLabel: building,
    metadata: {
      clientDraftId,
      reportedBy: user._id.toString(),
      reportedByName: user.name,
      demo: Boolean(payload.demo),
      pendingAttachments: payload.attachments || [],
      description: String(payload.description || ""),
      category: String(payload.type || "OTHER"),
      note: "Field report — attachments not auto-verified",
    },
    status: "OPEN",
  });

  const incident = await createOrUpdateIncident({
    organizationId,
    eventId: event._id.toString(),
    title: String(payload.title || "Field incident report"),
    severity,
    riskScore: 50,
    location: {
      campus: String(payload.campus || ""),
      building,
      room: String(payload.room || ""),
      camera: "",
      label: building,
    },
    source: "MOBILE_FIELD",
  });

  return {
    conflict: false as const,
    incidentId: incident.incidentId as string,
    eventId: event._id.toString(),
  };
}
