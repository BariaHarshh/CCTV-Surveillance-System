import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Campus, type ICampus } from "@/models/Campus";
import { Building } from "@/models/Building";
import { Room } from "@/models/Room";
import { Camera } from "@/models/Camera";
import { Organization } from "@/models/Organization";
import { getNextSequence, formatCampusId } from "@/models/Counter";
import type { CampusUpdateInput } from "@/lib/campus/schemas";

export function orgFilter(organizationId: string, extra: Record<string, unknown> = {}) {
  return {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    ...extra,
  };
}

export async function getOrCreateCampus(organizationId: string): Promise<ICampus> {
  await connectDB();
  let campus = await Campus.findOne(orgFilter(organizationId));
  if (campus) return campus;

  const org = await Organization.findOne({ _id: organizationId, deletedAt: null });
  if (!org) throw new Error("Organization not found.");

  const seq = await getNextSequence("campus");
  campus = await Campus.create({
    campusId: await formatCampusId(seq),
    organizationId: org._id,
    name: org.campus.name,
    type: org.campus.type,
    address: org.location.address ?? "",
    students: org.campus.students,
    faculty: org.campus.faculty,
    securityPersonnel: org.campus.securityPersonnel,
    status: "ACTIVE",
  });
  return campus;
}

export function toCampusSummary(campus: ICampus, stats?: CampusStats) {
  return {
    id: campus._id.toString(),
    campusId: campus.campusId,
    name: campus.name,
    type: campus.type,
    address: campus.address,
    coordinates: campus.coordinates,
    students: campus.students,
    faculty: campus.faculty,
    securityPersonnel: campus.securityPersonnel,
    status: campus.status,
    statistics: stats ?? null,
    createdAt: campus.createdAt.toISOString(),
    updatedAt: campus.updatedAt.toISOString(),
  };
}

export interface CampusStats {
  buildings: number;
  rooms: number;
  cameras: number;
  onlineCameras: number;
  offlineCameras: number;
  maintenanceCameras: number;
  errorCameras: number;
  totalCapacity: number;
}

export async function getCampusStatistics(organizationId: string, campusId: string): Promise<CampusStats> {
  await connectDB();
  const base = orgFilter(organizationId, { campusId: new mongoose.Types.ObjectId(campusId) });

  const [buildings, rooms, cameraStatusCounts, capacityAgg] = await Promise.all([
    Building.countDocuments(base),
    Room.countDocuments(base),
    Camera.aggregate([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Room.aggregate([{ $match: base }, { $group: { _id: null, total: { $sum: "$maxCapacity" } } }]),
  ]);

  const statusMap = Object.fromEntries(cameraStatusCounts.map((s: { _id: string; count: number }) => [s._id, s.count]));
  const totalCameras = Object.values(statusMap).reduce((a: number, b: number) => a + b, 0);

  return {
    buildings,
    rooms,
    cameras: totalCameras,
    onlineCameras: statusMap.ONLINE ?? 0,
    offlineCameras: (statusMap.OFFLINE ?? 0) + (statusMap.DISABLED ?? 0),
    maintenanceCameras: statusMap.MAINTENANCE ?? 0,
    errorCameras: statusMap.ERROR ?? 0,
    totalCapacity: capacityAgg[0]?.total ?? 0,
  };
}

export async function getCampusOverview(organizationId: string) {
  const campus = await getOrCreateCampus(organizationId);
  const stats = await getCampusStatistics(organizationId, campus._id.toString());
  return toCampusSummary(campus, stats);
}

export async function updateCampus(organizationId: string, data: CampusUpdateInput) {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  if (data.name) campus.name = data.name;
  if (data.type) campus.type = data.type;
  if (data.address !== undefined) campus.address = data.address;
  if (data.coordinates) campus.coordinates = data.coordinates;
  if (data.students !== undefined) campus.students = data.students;
  if (data.faculty !== undefined) campus.faculty = data.faculty;
  if (data.securityPersonnel !== undefined) campus.securityPersonnel = data.securityPersonnel;
  await campus.save();
  const stats = await getCampusStatistics(organizationId, campus._id.toString());
  return toCampusSummary(campus, stats);
}

export interface HierarchyNode {
  id: string;
  label: string;
  type: "campus" | "building" | "floor" | "room";
  children?: HierarchyNode[];
  meta?: Record<string, string | number>;
}

export async function getCampusHierarchy(organizationId: string): Promise<HierarchyNode> {
  await connectDB();
  const campus = await getOrCreateCampus(organizationId);
  const [buildings, rooms] = await Promise.all([
    Building.find(orgFilter(organizationId, { campusId: campus._id })).sort({ name: 1 }),
    Room.find(orgFilter(organizationId, { campusId: campus._id })).sort({ floor: 1, roomNumber: 1 }),
  ]);

  const roomsByBuilding = new Map<string, typeof rooms>();
  for (const room of rooms) {
    const bid = room.buildingId.toString();
    if (!roomsByBuilding.has(bid)) roomsByBuilding.set(bid, []);
    roomsByBuilding.get(bid)!.push(room);
  }

  return {
    id: campus._id.toString(),
    label: campus.name,
    type: "campus",
    children: buildings.map((b) => {
      const buildingRooms = roomsByBuilding.get(b._id.toString()) ?? [];
      const floors = new Map<number, typeof buildingRooms>();
      for (const r of buildingRooms) {
        if (!floors.has(r.floor)) floors.set(r.floor, []);
        floors.get(r.floor)!.push(r);
      }
      const floorNodes: HierarchyNode[] = Array.from(floors.entries())
        .sort(([a], [b]) => a - b)
        .map(([floor, floorRooms]) => ({
          id: `${b._id.toString()}-f${floor}`,
          label: `Floor ${floor}`,
          type: "floor" as const,
          children: floorRooms.map((r) => ({
            id: r._id.toString(),
            label: `${r.roomNumber} — ${r.name}`,
            type: "room" as const,
            meta: { roomId: r.roomId, code: r.code, status: r.status },
          })),
        }));

      if (floorNodes.length === 0 && b.floors > 0) {
        for (let f = 1; f <= b.floors; f++) {
          floorNodes.push({ id: `${b._id.toString()}-f${f}`, label: `Floor ${f}`, type: "floor", children: [] });
        }
      }

      return {
        id: b._id.toString(),
        label: b.name,
        type: "building" as const,
        meta: { buildingId: b.buildingId, code: b.code, status: b.status },
        children: floorNodes,
      };
    }),
  };
}

export async function assertResourceInOrg(
  organizationId: string,
  resourceOrgId: mongoose.Types.ObjectId | string
): Promise<void> {
  if (resourceOrgId.toString() !== organizationId) {
    throw new OrgIsolationError();
  }
}

export class OrgIsolationError extends Error {
  constructor() {
    super("Access denied.");
    this.name = "OrgIsolationError";
  }
}
