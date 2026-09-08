import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { Building } from "@/models/Building";
import { Floor, FloorPlan, newMapId } from "@/models/Map";
import { FLOOR_PLAN_MIME, FLOOR_PLAN_STATUSES } from "@/lib/map/constants";
import { ensureFloorsForBuilding } from "@/lib/map/map-service";
import { logAuditEvent } from "@/lib/audit/log";
import type { IUser } from "@/models/User";

const STORAGE_ROOT = path.join(process.cwd(), ".data", "floor-plans");

function storagePath(organizationId: string, floorPlanId: string) {
  return path.join(STORAGE_ROOT, organizationId, floorPlanId);
}

export async function listFloorPlans(
  organizationId: string,
  opts: { buildingId?: string; floorId?: string; includeDrafts?: boolean }
) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.buildingId) {
    const b = await Building.findOne(
      orgFilter(organizationId, {
        $or: [
          { buildingId: opts.buildingId },
          ...(mongoose.Types.ObjectId.isValid(opts.buildingId) ? [{ _id: opts.buildingId }] : []),
        ],
      })
    );
    if (!b) return [];
    filter.buildingId = b._id;
  }
  if (opts.floorId) filter.floorId = opts.floorId;
  if (!opts.includeDrafts) filter.status = "PUBLISHED";

  const plans = await FloorPlan.find(orgFilter(organizationId, filter)).sort({ updatedAt: -1 });
  return plans.map((fp) => ({
    floorPlanId: fp.floorPlanId,
    buildingId: fp.buildingId.toString(),
    floorId: fp.floorId,
    version: fp.version,
    width: fp.width,
    height: fp.height,
    status: fp.status,
    mimeType: fp.mimeType,
    originalName: fp.originalName,
    createdAt: fp.createdAt.toISOString(),
    updatedAt: fp.updatedAt.toISOString(),
    imageUrl: `/api/map/floor-plans/${fp.floorPlanId}/image`,
  }));
}

export async function uploadFloorPlan(opts: {
  organizationId: string;
  user: IUser;
  buildingId: string;
  floorId?: string;
  level?: number;
  file: { buffer: Buffer; mimeType: string; originalName: string; width?: number; height?: number };
}) {
  await connectDB();
  if (!(FLOOR_PLAN_MIME as readonly string[]).includes(opts.file.mimeType)) {
    throw new Error("Unsupported file type. Allowed: PNG, JPG, SVG, PDF.");
  }
  if (opts.file.buffer.length > 15 * 1024 * 1024) {
    throw new Error("File too large (max 15MB).");
  }

  const building = await Building.findOne(
    orgFilter(opts.organizationId, {
      $or: [
        { buildingId: opts.buildingId },
        ...(mongoose.Types.ObjectId.isValid(opts.buildingId) ? [{ _id: opts.buildingId }] : []),
      ],
    })
  );
  if (!building) throw new Error("Building not found.");

  const floors = await ensureFloorsForBuilding(
    opts.organizationId,
    building.campusId,
    building
  );
  const floor =
    (opts.floorId && floors.find((f) => f.floorId === opts.floorId)) ||
    (opts.level != null && floors.find((f) => f.level === opts.level)) ||
    floors[0];
  if (!floor) throw new Error("Floor not found.");

  const latest = await FloorPlan.findOne(
    orgFilter(opts.organizationId, { floorId: floor.floorId })
  ).sort({ version: -1 });

  const floorPlanId = newMapId("fp");
  const imageReference = `floorplan:${floorPlanId}`;
  const dest = storagePath(opts.organizationId, floorPlanId);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, opts.file.buffer);

  const plan = await FloorPlan.create({
    floorPlanId,
    organizationId: new mongoose.Types.ObjectId(opts.organizationId),
    campusId: building.campusId,
    buildingId: building._id,
    floorId: floor.floorId,
    imageReference,
    mimeType: opts.file.mimeType,
    originalName: opts.file.originalName,
    version: (latest?.version ?? 0) + 1,
    width: opts.file.width ?? 0,
    height: opts.file.height ?? 0,
    status: "DRAFT",
    createdBy: opts.user._id,
  });

  await logAuditEvent({
    actor: opts.user,
    action: "FLOOR_PLAN_UPLOADED",
    description: `Uploaded floor plan ${floorPlanId} for ${building.name}`,
    targetType: "FloorPlan",
    targetId: floorPlanId,
    targetLabel: building.name,
    metadata: { floorId: floor.floorId, version: plan.version },
  });

  return {
    floorPlanId: plan.floorPlanId,
    status: plan.status,
    version: plan.version,
    floorId: plan.floorId,
    imageUrl: `/api/map/floor-plans/${plan.floorPlanId}/image`,
  };
}

export async function setFloorPlanStatus(
  organizationId: string,
  user: IUser,
  floorPlanId: string,
  status: (typeof FLOOR_PLAN_STATUSES)[number]
) {
  await connectDB();
  const plan = await FloorPlan.findOne(orgFilter(organizationId, { floorPlanId }));
  if (!plan) return null;

  if (status === "PUBLISHED") {
    // Archive previous published for same floor
    await FloorPlan.updateMany(
      orgFilter(organizationId, {
        floorId: plan.floorId,
        status: "PUBLISHED",
        floorPlanId: { $ne: floorPlanId },
      }),
      { $set: { status: "ARCHIVED" } }
    );
  }

  plan.status = status;
  await plan.save();

  if (status === "PUBLISHED") {
    await logAuditEvent({
      actor: user,
      action: "FLOOR_PLAN_PUBLISHED",
      description: `Published floor plan ${floorPlanId}`,
      targetType: "FloorPlan",
      targetId: floorPlanId,
    });
  }

  return { floorPlanId: plan.floorPlanId, status: plan.status, version: plan.version };
}

export async function readFloorPlanImage(organizationId: string, floorPlanId: string, allowDraft: boolean) {
  await connectDB();
  const plan = await FloorPlan.findOne(orgFilter(organizationId, { floorPlanId }));
  if (!plan) return null;
  if (!allowDraft && plan.status !== "PUBLISHED") return null;

  const dest = storagePath(organizationId, floorPlanId);
  try {
    const buffer = await fs.readFile(dest);
    return { buffer, mimeType: plan.mimeType, status: plan.status };
  } catch {
    return null;
  }
}

export async function getFloorOverview(organizationId: string, floorId: string, allowDraft: boolean) {
  await connectDB();
  const floor = await Floor.findOne(orgFilter(organizationId, { floorId }));
  if (!floor) return null;
  const building = await Building.findOne(orgFilter(organizationId, { _id: floor.buildingId }));
  const plans = await listFloorPlans(organizationId, {
    floorId,
    includeDrafts: allowDraft,
  });
  return {
    floor: {
      floorId: floor.floorId,
      level: floor.level,
      name: floor.name,
      buildingId: building?.buildingId ?? null,
      buildingName: building?.name ?? null,
    },
    floorPlans: plans,
  };
}
