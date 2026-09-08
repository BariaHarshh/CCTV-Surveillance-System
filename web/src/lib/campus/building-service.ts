import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Building, type IBuilding } from "@/models/Building";
import { Room } from "@/models/Room";
import { Camera } from "@/models/Camera";
import { getNextSequence, formatBuildingId } from "@/models/Counter";
import type { BuildingCreateInput, BuildingUpdateInput } from "@/lib/campus/schemas";
import { getOrCreateCampus, orgFilter, assertResourceInOrg, OrgIsolationError } from "@/lib/campus/service";

export function toBuildingSummary(b: IBuilding, counts?: { rooms: number; cameras: number }) {
  return {
    id: b._id.toString(),
    buildingId: b.buildingId,
    campusId: b.campusId.toString(),
    name: b.name,
    code: b.code,
    type: b.type,
    description: b.description,
    floors: b.floors,
    roomCount: counts?.rooms ?? b.roomCount,
    entrances: b.entrances,
    exits: b.exits,
    address: b.address,
    coordinates: b.coordinates,
    cameras: counts?.cameras ?? 0,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function listBuildings(organizationId: string, params?: { q?: string; status?: string }) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  const filter: Record<string, unknown> = orgFilter(organizationId, { campusId: campus._id });
  if (params?.status && params.status !== "ALL") filter.status = params.status;
  if (params?.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { code: { $regex: q, $options: "i" } },
      { buildingId: { $regex: q, $options: "i" } },
    ];
  }

  const buildings = await Building.find(filter).sort({ name: 1 });
  const summaries = await Promise.all(
    buildings.map(async (b) => {
      const [rooms, cameras] = await Promise.all([
        Room.countDocuments({ buildingId: b._id }),
        Camera.countDocuments({ buildingId: b._id }),
      ]);
      return toBuildingSummary(b, { rooms, cameras });
    })
  );
  return summaries;
}

export async function getBuildingById(organizationId: string, id: string) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const b = await Building.findOne(orgFilter(organizationId, { _id: id }));
  if (!b) return null;
  const [rooms, cameras] = await Promise.all([
    Room.countDocuments({ buildingId: b._id }),
    Camera.countDocuments({ buildingId: b._id }),
  ]);
  return toBuildingSummary(b, { rooms, cameras });
}

export async function createBuilding(organizationId: string, data: BuildingCreateInput) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);

  const existing = await Building.findOne(orgFilter(organizationId, { code: data.code }));
  if (existing) throw new Error("Building code already exists in this organization.");

  const seq = await getNextSequence("building");
  const building = await Building.create({
    buildingId: await formatBuildingId(seq),
    organizationId: campus.organizationId,
    campusId: campus._id,
    name: data.name,
    code: data.code,
    type: data.type,
    description: data.description,
    floors: data.floors,
    entrances: data.entrances,
    exits: data.exits,
    address: data.address,
    coordinates: data.coordinates ?? { lat: null, lng: null },
    status: "ACTIVE",
  });
  return toBuildingSummary(building, { rooms: 0, cameras: 0 });
}

export async function updateBuilding(organizationId: string, id: string, data: BuildingUpdateInput) {
  await connectDB();
  const building = await Building.findOne(orgFilter(organizationId, { _id: id }));
  if (!building) return null;

  if (data.code && data.code !== building.code) {
    const dup = await Building.findOne(orgFilter(organizationId, { code: data.code, _id: { $ne: building._id } }));
    if (dup) throw new Error("Building code already exists.");
    building.code = data.code;
  }
  if (data.name) building.name = data.name;
  if (data.type) building.type = data.type;
  if (data.description !== undefined) building.description = data.description;
  if (data.floors !== undefined) building.floors = data.floors;
  if (data.entrances !== undefined) building.entrances = data.entrances;
  if (data.exits !== undefined) building.exits = data.exits;
  if (data.address !== undefined) building.address = data.address;
  if (data.coordinates) building.coordinates = data.coordinates;
  await building.save();

  const [rooms, cameras] = await Promise.all([
    Room.countDocuments({ buildingId: building._id }),
    Camera.countDocuments({ buildingId: building._id }),
  ]);
  return toBuildingSummary(building, { rooms, cameras });
}

export async function updateBuildingStatus(organizationId: string, id: string, status: "ACTIVE" | "INACTIVE") {
  await connectDB();
  const building = await Building.findOne(orgFilter(organizationId, { _id: id }));
  if (!building) return null;
  building.status = status;
  await building.save();
  return toBuildingSummary(building);
}

export { OrgIsolationError, assertResourceInOrg };
