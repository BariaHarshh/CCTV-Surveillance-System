import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Event } from "@/models/Event";
import { Camera } from "@/models/Camera";
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

  const isMongoId = mongoose.Types.ObjectId.isValid(key.cameraId);
  const cameraQuery = isMongoId ? { $or: [{ _id: key.cameraId }, { cameraId: key.cameraId }] } : { cameraId: key.cameraId };
  const camera = await Camera.findOne(orgFilter(key.organizationId, cameraQuery)).select("_id");
  const targetCameraId = camera ? camera._id : (isMongoId ? new mongoose.Types.ObjectId(key.cameraId) : null);

  const since = new Date(Date.now() - cooldownSeconds * 1000);
  const filter: Record<string, unknown> = orgFilter(key.organizationId, {
    ...(targetCameraId ? { cameraId: targetCameraId } : {}),
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
