import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { RestrictedZone, type IRestrictedZone } from "@/models/RestrictedZone";
import { getNextSequence, formatZoneId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import { Camera } from "@/models/Camera";
import { Building } from "@/models/Building";
import { Room } from "@/models/Room";

function toPublic(z: IRestrictedZone, extra?: { cameraName?: string; buildingName?: string; roomName?: string }) {
  return {
    id: z._id.toString(),
    zoneId: z.zoneId,
    name: z.name,
    cameraId: z.cameraId.toString(),
    cameraName: extra?.cameraName,
    buildingId: z.buildingId?.toString() ?? null,
    buildingName: extra?.buildingName,
    roomId: z.roomId?.toString() ?? null,
    roomName: extra?.roomName,
    polygon: z.polygon,
    scheduleId: z.scheduleId?.toString() ?? null,
    allowedRoles: z.allowedRoles,
    status: z.status,
    createdAt: z.createdAt.toISOString(),
  };
}

export async function listRestrictedZones(organizationId: string) {
  await connectDB();
  const zones = await RestrictedZone.find(orgFilter(organizationId)).sort({ name: 1 });
  const result = await Promise.all(
    zones.map(async (z) => {
      const [cam, building, room] = await Promise.all([
        Camera.findById(z.cameraId).select("name"),
        z.buildingId ? Building.findById(z.buildingId).select("name") : null,
        z.roomId ? Room.findById(z.roomId).select("name") : null,
      ]);
      return toPublic(z, { cameraName: cam?.name, buildingName: building?.name, roomName: room?.name });
    })
  );
  return result;
}

export async function createRestrictedZone(organizationId: string, data: {
  name: string;
  cameraId: string;
  buildingId?: string | null;
  roomId?: string | null;
  polygon?: IRestrictedZone["polygon"];
  scheduleId?: string | null;
  allowedRoles?: string[];
}) {
  await connectDB();
  const seq = await getNextSequence("zone");
  const zone = await RestrictedZone.create({
    zoneId: await formatZoneId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    name: data.name,
    cameraId: new mongoose.Types.ObjectId(data.cameraId),
    buildingId: data.buildingId ? new mongoose.Types.ObjectId(data.buildingId) : null,
    roomId: data.roomId ? new mongoose.Types.ObjectId(data.roomId) : null,
    polygon: data.polygon ?? [],
    scheduleId: data.scheduleId ? new mongoose.Types.ObjectId(data.scheduleId) : null,
    allowedRoles: data.allowedRoles ?? [],
    status: "ACTIVE",
  });
  return toPublic(zone);
}

export async function updateRestrictedZone(
  organizationId: string,
  id: string,
  patch: {
    name?: string;
    polygon?: IRestrictedZone["polygon"];
    scheduleId?: string | null;
    allowedRoles?: string[];
    status?: "ACTIVE" | "INACTIVE";
  }
) {
  await connectDB();
  const zone = await RestrictedZone.findOne(orgFilter(organizationId, { _id: id }));
  if (!zone) return null;
  if (patch.name) zone.name = patch.name;
  if (patch.polygon) zone.polygon = patch.polygon;
  if (patch.scheduleId !== undefined) zone.scheduleId = patch.scheduleId ? new mongoose.Types.ObjectId(String(patch.scheduleId)) : null;
  if (patch.allowedRoles) zone.allowedRoles = patch.allowedRoles;
  if (patch.status) zone.status = patch.status as "ACTIVE" | "INACTIVE";
  await zone.save();
  return toPublic(zone);
}

export async function deleteRestrictedZone(organizationId: string, id: string) {
  await connectDB();
  const result = await RestrictedZone.deleteOne(orgFilter(organizationId, { _id: id }));
  return result.deletedCount > 0;
}

export async function getActiveZonesForCamera(organizationId: string, cameraId: string) {
  await connectDB();
  const isMongoId = mongoose.Types.ObjectId.isValid(cameraId);
  const cameraQuery = isMongoId ? { $or: [{ _id: cameraId }, { cameraId }] } : { cameraId };
  const camera = await Camera.findOne(orgFilter(organizationId, cameraQuery)).select("_id");
  const targetCameraObjectId = camera ? camera._id : (isMongoId ? new mongoose.Types.ObjectId(cameraId) : null);

  if (!targetCameraObjectId) return [];

  return RestrictedZone.find(
    orgFilter(organizationId, { cameraId: targetCameraObjectId, status: "ACTIVE" })
  );
}
