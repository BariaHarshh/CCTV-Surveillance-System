import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Room, type IRoom } from "@/models/Room";
import { Building } from "@/models/Building";
import { Camera } from "@/models/Camera";
import { getNextSequence, formatRoomId } from "@/models/Counter";
import type { RoomCreateInput, RoomUpdateInput } from "@/lib/campus/schemas";
import { getOrCreateCampus, orgFilter } from "@/lib/campus/service";

export function toRoomSummary(r: IRoom, buildingName?: string, cameraCount = 0) {
  return {
    id: r._id.toString(),
    roomId: r.roomId,
    campusId: r.campusId.toString(),
    buildingId: r.buildingId.toString(),
    buildingName: buildingName ?? "",
    floor: r.floor,
    name: r.name,
    roomNumber: r.roomNumber,
    code: r.code,
    type: r.type,
    maxCapacity: r.maxCapacity,
    normalCapacity: r.normalCapacity,
    purpose: r.purpose,
    cameras: cameraCount,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listRooms(
  organizationId: string,
  params?: { q?: string; status?: string; buildingId?: string }
) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  const filter: Record<string, unknown> = orgFilter(organizationId, { campusId: campus._id });
  if (params?.status && params.status !== "ALL") filter.status = params.status;
  if (params?.buildingId) filter.buildingId = new mongoose.Types.ObjectId(params.buildingId);
  if (params?.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { code: { $regex: q, $options: "i" } },
      { roomNumber: { $regex: q, $options: "i" } },
      { roomId: { $regex: q, $options: "i" } },
    ];
  }

  const rooms = await Room.find(filter).sort({ buildingId: 1, floor: 1, roomNumber: 1 });
  const buildingIds = [...new Set(rooms.map((r) => r.buildingId.toString()))];
  const buildings = await Building.find({ _id: { $in: buildingIds } });
  const buildingMap = Object.fromEntries(buildings.map((b) => [b._id.toString(), b.name]));

  return Promise.all(
    rooms.map(async (r) => {
      const cameras = await Camera.countDocuments({ roomId: r._id });
      return toRoomSummary(r, buildingMap[r.buildingId.toString()], cameras);
    })
  );
}

export async function getRoomById(organizationId: string, id: string) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const r = await Room.findOne(orgFilter(organizationId, { _id: id }));
  if (!r) return null;
  const building = await Building.findById(r.buildingId);
  const cameras = await Camera.countDocuments({ roomId: r._id });
  return toRoomSummary(r, building?.name, cameras);
}

export async function createRoom(organizationId: string, data: RoomCreateInput) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  const building = await Building.findOne(orgFilter(organizationId, { _id: data.buildingId }));
  if (!building) throw new Error("Building not found.");

  const existing = await Room.findOne(orgFilter(organizationId, { code: data.code }));
  if (existing) throw new Error("Room code already exists in this organization.");

  const seq = await getNextSequence("room");
  const room = await Room.create({
    roomId: await formatRoomId(seq),
    organizationId: campus.organizationId,
    campusId: campus._id,
    buildingId: building._id,
    floor: data.floor,
    name: data.name,
    roomNumber: data.roomNumber,
    code: data.code,
    type: data.type,
    maxCapacity: data.maxCapacity,
    normalCapacity: data.normalCapacity,
    purpose: data.purpose,
    status: "ACTIVE",
  });

  await Building.updateOne({ _id: building._id }, { $inc: { roomCount: 1 } });
  return toRoomSummary(room, building.name, 0);
}

export async function updateRoom(organizationId: string, id: string, data: RoomUpdateInput) {
  await connectDB();
  const room = await Room.findOne(orgFilter(organizationId, { _id: id }));
  if (!room) return null;

  if (data.buildingId) {
    const building = await Building.findOne(orgFilter(organizationId, { _id: data.buildingId }));
    if (!building) throw new Error("Building not found.");
    room.buildingId = building._id;
  }
  if (data.code && data.code !== room.code) {
    const dup = await Room.findOne(orgFilter(organizationId, { code: data.code, _id: { $ne: room._id } }));
    if (dup) throw new Error("Room code already exists.");
    room.code = data.code;
  }
  if (data.name) room.name = data.name;
  if (data.roomNumber) room.roomNumber = data.roomNumber;
  if (data.floor !== undefined) room.floor = data.floor;
  if (data.type) room.type = data.type;
  if (data.maxCapacity !== undefined) room.maxCapacity = data.maxCapacity;
  if (data.normalCapacity !== undefined) room.normalCapacity = data.normalCapacity;
  if (data.purpose !== undefined) room.purpose = data.purpose;
  await room.save();

  const building = await Building.findById(room.buildingId);
  const cameras = await Camera.countDocuments({ roomId: room._id });
  return toRoomSummary(room, building?.name, cameras);
}

export async function updateRoomStatus(organizationId: string, id: string, status: "ACTIVE" | "INACTIVE") {
  await connectDB();
  const room = await Room.findOne(orgFilter(organizationId, { _id: id }));
  if (!room) return null;
  room.status = status;
  await room.save();
  const building = await Building.findById(room.buildingId);
  const cameras = await Camera.countDocuments({ roomId: room._id });
  return toRoomSummary(room, building?.name, cameras);
}
