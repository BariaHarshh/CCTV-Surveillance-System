import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Camera, type ICamera } from "@/models/Camera";
import { Building } from "@/models/Building";
import { Room } from "@/models/Room";
import { getNextSequence, formatCameraId } from "@/models/Counter";
import { encryptSecret } from "@/lib/security/encrypt";
import type { CameraCreateInput, CameraUpdateInput } from "@/lib/campus/schemas";
import { getOrCreateCampus, orgFilter } from "@/lib/campus/service";

export function toCameraPublic(c: ICamera, location?: { building?: string; room?: string; campus?: string }) {
  return {
    id: c._id.toString(),
    cameraId: c.cameraId,
    name: c.name,
    type: c.type,
    manufacturer: c.manufacturer,
    model: c.deviceModel,
    serialNumber: c.serialNumber,
    campusId: c.campusId.toString(),
    buildingId: c.buildingId?.toString() ?? null,
    roomId: c.roomId?.toString() ?? null,
    floor: c.floor,
    areaLabel: c.areaLabel,
    location: location ?? {},
    connection: {
      streamUrl: maskStreamUrl(c.connection.streamUrl),
      protocol: c.connection.protocol,
      connectionType: c.connection.connectionType,
      hasCredentials: Boolean(c.connection.usernameEncrypted || c.connection.passwordEncrypted),
    },
    status: c.status,
    lastSeen: c.lastSeen?.toISOString() ?? null,
    lastTestAt: c.lastTestAt?.toISOString() ?? null,
    lastTestSuccess: c.lastTestSuccess,
    mapLocation: c.mapLocation
      ? {
          lat: c.mapLocation.lat,
          lng: c.mapLocation.lng,
          viewingDirectionDeg: c.mapLocation.viewingDirectionDeg,
          coverageRadiusM: c.mapLocation.coverageRadiusM,
          coverageAngleDeg: c.mapLocation.coverageAngleDeg,
          mapX: c.mapLocation.mapX,
          mapY: c.mapLocation.mapY,
          source: c.mapLocation.source,
          accuracyM: c.mapLocation.accuracyM,
          lastUpdated: c.mapLocation.lastUpdated?.toISOString() ?? null,
          calibrated: Boolean(c.mapLocation.calibrated),
          coverageNote: c.mapLocation.calibrated
            ? "Calibrated coverage"
            : "Coverage is a configuration estimate",
        }
      : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function maskStreamUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    if (u.username) u.username = "****";
    return u.toString();
  } catch {
    return url.replace(/:[^:@/]+@/, ":****@");
  }
}

async function resolveLocation(c: ICamera) {
  const [building, room, campus] = await Promise.all([
    c.buildingId ? Building.findById(c.buildingId).select("name") : null,
    c.roomId ? Room.findById(c.roomId).select("name roomNumber") : null,
    getOrCreateCampus(c.organizationId.toString()),
  ]);
  return {
    campus: campus.name,
    building: building?.name,
    room: room ? `${room.roomNumber} — ${room.name}` : undefined,
  };
}

export async function listCameras(organizationId: string, params?: { q?: string; status?: string }) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  const filter: Record<string, unknown> = orgFilter(organizationId, { campusId: campus._id });
  if (params?.status && params.status !== "ALL") filter.status = params.status;
  if (params?.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { cameraId: { $regex: q, $options: "i" } },
      { serialNumber: { $regex: q, $options: "i" } },
    ];
  }

  const cameras = await Camera.find(filter).sort({ name: 1 });
  return Promise.all(
    cameras.map(async (c) => toCameraPublic(c, await resolveLocation(c)))
  );
}

export async function getCameraById(organizationId: string, id: string) {
  await connectDB();
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { _id: id } : { cameraId: id };
  const c = await Camera.findOne(orgFilter(organizationId, query));
  if (!c) return null;
  return toCameraPublic(c, await resolveLocation(c));
}

export async function createCamera(organizationId: string, data: CameraCreateInput) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);

  if (data.buildingId) {
    const b = await Building.findOne(orgFilter(organizationId, { _id: data.buildingId }));
    if (!b) throw new Error("Building not found.");
  }
  if (data.roomId) {
    const r = await Room.findOne(orgFilter(organizationId, { _id: data.roomId }));
    if (!r) throw new Error("Room not found.");
  }

  const seq = await getNextSequence("camera");
  const camera = await Camera.create({
    cameraId: await formatCameraId(seq),
    organizationId: campus.organizationId,
    campusId: campus._id,
    buildingId: data.buildingId ? new mongoose.Types.ObjectId(data.buildingId) : null,
    roomId: data.roomId ? new mongoose.Types.ObjectId(data.roomId) : null,
    floor: data.floor ?? null,
    areaLabel: data.areaLabel,
    name: data.name,
    type: data.type,
    manufacturer: data.manufacturer,
    deviceModel: data.model,
    serialNumber: data.serialNumber,
    connection: {
      streamUrl: data.connection.streamUrl,
      protocol: data.connection.protocol,
      connectionType: data.connection.connectionType,
      usernameEncrypted: data.connection.username ? encryptSecret(data.connection.username) : "",
      passwordEncrypted: data.connection.password ? encryptSecret(data.connection.password) : "",
    },
    status: "OFFLINE",
  });

  return toCameraPublic(camera, await resolveLocation(camera));
}

export async function updateCamera(organizationId: string, id: string, data: CameraUpdateInput) {
  await connectDB();
  const camera = await Camera.findOne(orgFilter(organizationId, { _id: id })).select("+connection.usernameEncrypted +connection.passwordEncrypted");
  if (!camera) return null;

  if (data.name) camera.name = data.name;
  if (data.type) camera.type = data.type;
  if (data.manufacturer !== undefined) camera.manufacturer = data.manufacturer;
  if (data.model !== undefined) camera.deviceModel = data.model;
  if (data.serialNumber !== undefined) camera.serialNumber = data.serialNumber;
  if (data.floor !== undefined) camera.floor = data.floor;
  if (data.areaLabel !== undefined) camera.areaLabel = data.areaLabel;
  if (data.buildingId !== undefined) {
    camera.buildingId = data.buildingId ? new mongoose.Types.ObjectId(data.buildingId) : null;
  }
  if (data.roomId !== undefined) {
    camera.roomId = data.roomId ? new mongoose.Types.ObjectId(data.roomId) : null;
  }
  if (data.connection) {
    if (data.connection.streamUrl) camera.connection.streamUrl = data.connection.streamUrl;
    if (data.connection.protocol) camera.connection.protocol = data.connection.protocol;
    if (data.connection.connectionType) camera.connection.connectionType = data.connection.connectionType;
    if (data.connection.username !== undefined) {
      camera.connection.usernameEncrypted = data.connection.username ? encryptSecret(data.connection.username) : "";
    }
    if (data.connection.password !== undefined) {
      camera.connection.passwordEncrypted = data.connection.password ? encryptSecret(data.connection.password) : "";
    }
  }
  await camera.save();
  return toCameraPublic(camera, await resolveLocation(camera));
}

export async function updateCameraStatus(
  organizationId: string,
  id: string,
  status: ICamera["status"]
) {
  await connectDB();
  const camera = await Camera.findOne(orgFilter(organizationId, { _id: id }));
  if (!camera) return null;
  camera.status = status;
  await camera.save();
  return toCameraPublic(camera, await resolveLocation(camera));
}

export async function deleteCamera(organizationId: string, id: string) {
  await connectDB();
  const camera = await Camera.findOneAndDelete(orgFilter(organizationId, { _id: id }));
  if (!camera) return null;
  return toCameraPublic(camera, {});
}

export async function getCameraStatistics(organizationId: string) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  const base = orgFilter(organizationId, { campusId: campus._id });
  const counts = await Camera.aggregate([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c: { _id: string; count: number }) => [c._id, c.count]));
  const total = Object.values(map).reduce((a: number, b: number) => a + b, 0);
  return {
    total,
    online: map.ONLINE ?? 0,
    offline: map.OFFLINE ?? 0,
    disabled: map.DISABLED ?? 0,
    maintenance: map.MAINTENANCE ?? 0,
    error: map.ERROR ?? 0,
    connecting: map.CONNECTING ?? 0,
  };
}

export async function testCameraConnection(organizationId: string, id: string) {
  await connectDB();
  const camera = await Camera.findOne(orgFilter(organizationId, { _id: id }));
  if (!camera) return null;

  camera.status = "CONNECTING";
  await camera.save();

  const { streamUrl, protocol } = camera.connection;
  let success = false;
  let message = "Unable to connect";

  try {
    if (protocol === "HTTP" || protocol === "HTTPS") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(streamUrl, { method: "HEAD", signal: controller.signal }).catch(() =>
        fetch(streamUrl, { method: "GET", signal: controller.signal })
      );
      clearTimeout(timeout);
      success = res.ok || res.status < 500;
      message = success ? "Camera connected" : "Unable to connect";
    } else {
      // RTSP/ONVIF — no live probe without native stack; validate URL shape only
      success = /^rtsp:\/\/.+/i.test(streamUrl) || streamUrl.length > 8;
      message = success
        ? "Stream URL validated. Live RTSP verification requires the monitoring engine (Step 7)."
        : "Invalid stream URL";
      success = false; // spec: do not show online unless backend verifies
    }
  } catch {
    success = false;
    message = "Unable to connect";
  }

  camera.lastTestAt = new Date();
  camera.lastTestSuccess = success;
  camera.status = success ? "ONLINE" : "OFFLINE";
  if (success) camera.lastSeen = new Date();
  await camera.save();

  return {
    success,
    message,
    camera: await toCameraPublic(camera, await resolveLocation(camera)),
  };
}
