import { connectDB } from "@/lib/db/connect";
import { Event } from "@/models/Event";
import { orgFilter } from "@/lib/campus/service";
import type { EventType } from "@/lib/monitoring/constants";

const CORRELATION_WINDOW_MS = 5 * 60 * 1000;

export async function findRelatedEvents(
  organizationId: string,
  cameraId: string,
  eventType: EventType,
  detectedAt: Date
): Promise<string[]> {
  await connectDB();
  const since = new Date(detectedAt.getTime() - CORRELATION_WINDOW_MS);

  const related = await Event.find(
    orgFilter(organizationId, {
      cameraId,
      detectedAt: { $gte: since, $lte: detectedAt },
      status: { $nin: ["DISMISSED", "FALSE_POSITIVE"] },
    })
  )
    .select("_id eventType detectedAt")
    .sort({ detectedAt: 1 });

  return related.map((e) => e._id.toString());
}

export function shouldCorrelate(eventTypes: EventType[]): boolean {
  const unique = new Set(eventTypes);
  return unique.size >= 2 || eventTypes.length >= 2;
}

export async function getRecentEventTypesForCamera(
  organizationId: string,
  cameraId: string,
  withinMs = CORRELATION_WINDOW_MS
): Promise<EventType[]> {
  await connectDB();
  const since = new Date(Date.now() - withinMs);
  const events = await Event.find(
    orgFilter(organizationId, { cameraId, detectedAt: { $gte: since } })
  )
    .select("eventType")
    .limit(20);
  return events.map((e) => e.eventType);
}
