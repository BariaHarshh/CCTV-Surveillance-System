import { connectDB } from "@/lib/db/connect";
import { Event } from "@/models/Event";
import { orgFilter } from "@/lib/campus/service";
import type { EventType } from "@/lib/monitoring/constants";

export interface DedupKey {
  organizationId: string;
  cameraId: string;
  eventType: EventType;
  zoneId?: string | null;
}

export async function isDuplicateEvent(
  key: DedupKey,
  cooldownSeconds: number
): Promise<boolean> {
  if (cooldownSeconds <= 0) return false;
  await connectDB();

  const since = new Date(Date.now() - cooldownSeconds * 1000);
  const filter: Record<string, unknown> = orgFilter(key.organizationId, {
    cameraId: key.cameraId,
    eventType: key.eventType,
    detectedAt: { $gte: since },
    status: { $nin: ["DISMISSED", "FALSE_POSITIVE"] },
  });

  if (key.zoneId) {
    filter["metadata.zoneId"] = key.zoneId;
  }

  const existing = await Event.findOne(filter).select("_id");
  return Boolean(existing);
}
