import { connectDB } from "@/lib/db/connect";
import { hashPassword } from "@/lib/auth/password";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";
import { getNextSequence, formatAdminId } from "@/models/Counter";
import type { AdminCreateInput } from "@/lib/organizations/schemas";
import mongoose from "mongoose";

export async function generateAdminUserId(): Promise<string> {
  const seq = await getNextSequence("admin");
  return formatAdminId(seq);
}

export async function createOrganizationAdmin(
  organizationId: string,
  data: AdminCreateInput
) {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    throw new Error("Invalid organization.");
  }

  const org = await Organization.findOne({ _id: organizationId, deletedAt: null });
  if (!org) throw new Error("Organization not found.");

  const existingUserId = await User.findOne({ userId: data.account.userId.toLowerCase() });
  if (existingUserId) throw new Error("Admin ID already exists.");

  const existingEmail = await User.findOne({ email: data.personal.email.toLowerCase() });
  if (existingEmail) throw new Error("Email already registered.");

  const passwordHash = await hashPassword(data.account.password);

  const admin = await User.create({
    name: data.personal.name,
    userId: data.account.userId.toLowerCase(),
    email: data.personal.email.toLowerCase(),
    passwordHash,
    role: "ADMIN",
    permissions: data.permissions,
    organizationId: org._id,
    status: "ACTIVE",
    mustChangePassword: true,
    profile: {
      phone: data.personal.phone,
      dateOfBirth: data.personal.dateOfBirth,
      gender: data.personal.gender,
      address: data.personal.address,
      photo: data.personal.photo,
    },
    professional: {
      employeeId: data.professional.employeeId,
      jobTitle: data.professional.jobTitle,
      jobTitleOther: data.professional.jobTitleOther,
      department: data.professional.department,
      joiningDate: data.professional.joiningDate,
      responsibilities: data.professional.responsibilities,
    },
    passwordChangedAt: null,
  });

  org.lastActivityAt = new Date();
  await org.save();

  return {
    admin: {
      id: admin._id.toString(),
      name: admin.name,
      userId: admin.userId,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      permissions: admin.permissions,
      organizationId: org._id.toString(),
      organizationName: org.basicInformation.name,
      organizationPublicId: org.organizationId,
      professional: admin.professional,
      createdAt: admin.createdAt.toISOString(),
    },
    temporaryPassword: data.account.password,
  };
}

export async function listOrganizationAdmins(organizationId: string, params?: { q?: string; status?: string }) {
  await connectDB();
  const filter: Record<string, unknown> = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    role: "ADMIN",
  };
  if (params?.status && params.status !== "ALL") filter.status = params.status;
  if (params?.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { userId: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { "professional.employeeId": { $regex: q, $options: "i" } },
    ];
  }

  const admins = await User.find(filter).sort({ createdAt: -1 }).lean();
  return admins.map((a) => ({
    id: a._id.toString(),
    name: a.name,
    userId: a.userId,
    email: a.email,
    status: a.status,
    jobTitle: a.professional?.jobTitle ?? "",
    department: a.professional?.department ?? "",
    employeeId: a.professional?.employeeId ?? "",
    lastLogin: a.lastLogin?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    permissions: a.permissions,
  }));
}

export async function getAdminById(id: string) {
  await connectDB();
  const admin = await User.findOne({ _id: id, role: "ADMIN" }).populate("organizationId");
  if (!admin) return null;

  const org = admin.organizationId as unknown as { basicInformation?: { name: string }; organizationId?: string } | null;

  return {
    id: admin._id.toString(),
    name: admin.name,
    userId: admin.userId,
    email: admin.email,
    status: admin.status,
    permissions: admin.permissions,
    profile: admin.profile,
    professional: admin.professional,
    organizationId: admin.organizationId?.toString() ?? null,
    organizationName: org && typeof org === "object" && "basicInformation" in org ? org.basicInformation?.name : null,
    organizationPublicId: org && typeof org === "object" && "organizationId" in org ? org.organizationId : null,
    lastLogin: admin.lastLogin?.toISOString() ?? null,
    createdAt: admin.createdAt.toISOString(),
    mustChangePassword: admin.mustChangePassword,
  };
}
