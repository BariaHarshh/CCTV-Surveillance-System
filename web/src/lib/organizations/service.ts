import { connectDB } from "@/lib/db/connect";
import {
  Organization,
  slugify,
  type IOrganization,
  type OrganizationStatus,
} from "@/models/Organization";
import { User } from "@/models/User";
import { getNextSequence, formatOrgId } from "@/models/Counter";
import type { OrganizationCreateInput } from "@/lib/organizations/schemas";
import mongoose from "mongoose";

export function toOrganizationSummary(org: IOrganization, counts?: { admins: number; staff: number }) {
  return {
    id: org._id.toString(),
    organizationId: org.organizationId,
    name: org.basicInformation.name,
    type: org.basicInformation.type === "Other" ? org.basicInformation.typeOther || "Other" : org.basicInformation.type,
    location: `${org.location.city}, ${org.location.state}`,
    city: org.location.city,
    country: org.location.country,
    admins: counts?.admins ?? 0,
    staff: counts?.staff ?? 0,
    cameras: org.campus.cameras,
    status: org.status,
    createdAt: org.createdAt.toISOString(),
    lastActivity: org.lastActivityAt?.toISOString() ?? org.updatedAt.toISOString(),
    basicInformation: org.basicInformation,
    locationDetails: org.location,
    campus: org.campus,
    purpose: org.purpose,
    primaryContact: org.primaryContact,
  };
}

export async function getOrganizationCounts(orgId: mongoose.Types.ObjectId) {
  const [admins, staff] = await Promise.all([
    User.countDocuments({ organizationId: orgId, role: "ADMIN" }),
    User.countDocuments({ organizationId: orgId, role: "STAFF" }),
  ]);
  return { admins, staff };
}

export async function createOrganization(data: OrganizationCreateInput) {
  await connectDB();

  let slug = slugify(data.basicInformation.name);
  const existingSlug = await Organization.findOne({ slug });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const seq = await getNextSequence("organization");
  const organizationId = await formatOrgId(seq);

  const org = await Organization.create({
    organizationId,
    slug,
    status: data.status ?? "ACTIVE",
    basicInformation: data.basicInformation,
    location: data.location,
    campus: data.campus,
    purpose: data.purpose,
    primaryContact: data.primaryContact,
    lastActivityAt: new Date(),
  });

  return org;
}

export async function listOrganizations(params: {
  q?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}) {
  await connectDB();

  const { q, status, type, page = 1, limit = 20, sort = "createdAt", order = "desc" } = params;
  const filter: Record<string, unknown> = { deletedAt: null };

  if (status && status !== "ALL") filter.status = status;
  if (type && type !== "ALL") filter["basicInformation.type"] = type;

  if (q?.trim()) {
    const search = q.trim();
    filter.$or = [
      { organizationId: { $regex: search, $options: "i" } },
      { "basicInformation.name": { $regex: search, $options: "i" } },
      { "location.city": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const sortField = sort === "name" ? "basicInformation.name" : sort === "status" ? "status" : "createdAt";
  const sortOrder = order === "asc" ? 1 : -1;

  const [orgs, total] = await Promise.all([
    Organization.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
    Organization.countDocuments(filter),
  ]);

  const summaries = await Promise.all(
    orgs.map(async (org) => {
      const counts = await getOrganizationCounts(org._id);
      return toOrganizationSummary(org, counts);
    })
  );

  return { organizations: summaries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getOrganizationStats() {
  await connectDB();

  const baseFilter = { deletedAt: null };
  const [statusCounts, totalCameras, totalCampusUsers] = await Promise.all([
    Organization.aggregate([{ $match: baseFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Organization.aggregate([
      { $match: baseFilter },
      { $group: { _id: null, total: { $sum: "$campus.cameras" } } },
    ]),
    User.countDocuments({ role: { $in: ["ADMIN", "STAFF"] }, organizationId: { $ne: null } }),
  ]);

  const map = Object.fromEntries(statusCounts.map((s: { _id: string; count: number }) => [s._id, s.count]));
  const total = Object.values(map).reduce((a: number, b: number) => a + b, 0);

  return {
    total,
    active: map.ACTIVE ?? 0,
    pending: map.PENDING ?? 0,
    suspended: map.SUSPENDED ?? 0,
    inactive: map.INACTIVE ?? 0,
    totalCameras: totalCameras[0]?.total ?? 0,
    totalCampusUsers,
  };
}

export async function getOrganizationById(id: string) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const org = await Organization.findOne({ _id: id, deletedAt: null });
  if (!org) return null;
  const counts = await getOrganizationCounts(org._id);
  return toOrganizationSummary(org, counts);
}

export async function updateOrganizationStatus(id: string, status: OrganizationStatus) {
  await connectDB();
  const org = await Organization.findOne({ _id: id, deletedAt: null });
  if (!org) return null;
  org.status = status;
  org.lastActivityAt = new Date();
  await org.save();
  return org;
}

export async function softDeleteOrganization(id: string) {
  await connectDB();
  const org = await Organization.findOne({ _id: id, deletedAt: null });
  if (!org) return null;
  org.status = "ARCHIVED";
  org.deletedAt = new Date();
  org.lastActivityAt = new Date();
  await org.save();
  return org;
}

export async function updateOrganization(id: string, data: Partial<OrganizationCreateInput>) {
  await connectDB();
  const org = await Organization.findOne({ _id: id, deletedAt: null });
  if (!org) return null;

  if (data.basicInformation) org.basicInformation = { ...org.basicInformation, ...data.basicInformation };
  if (data.location) org.location = { ...org.location, ...data.location };
  if (data.campus) org.campus = { ...org.campus, ...data.campus };
  if (data.purpose) org.purpose = { ...org.purpose, ...data.purpose };
  if (data.primaryContact) org.primaryContact = { ...org.primaryContact, ...data.primaryContact };

  org.lastActivityAt = new Date();
  await org.save();
  const counts = await getOrganizationCounts(org._id);
  return toOrganizationSummary(org, counts);
}
