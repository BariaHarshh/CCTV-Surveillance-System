import { connectDB } from "@/lib/db/connect";
import { hashPassword } from "@/lib/auth/password";
import { filterAssignableStaffPermissions } from "@/lib/auth/permissions";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";
import { getNextSequence, formatStaffId } from "@/models/Counter";
import type { StaffCreateInput, StaffUpdateInput } from "@/lib/staff/schemas";
import mongoose from "mongoose";
import type { IUser } from "@/models/User";

export async function generateStaffUserId(): Promise<string> {
  const seq = await getNextSequence("staff");
  return formatStaffId(seq);
}

function staffFilter(organizationId: string, extra: Record<string, unknown> = {}) {
  return {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    role: "STAFF" as const,
    ...extra,
  };
}

export async function createStaffMember(
  organizationId: string,
  admin: IUser,
  data: StaffCreateInput
) {
  await connectDB();

  const org = await Organization.findOne({ _id: organizationId, deletedAt: null });
  if (!org) throw new Error("Organization not found.");

  const permissions = filterAssignableStaffPermissions(admin.permissions, data.permissions);
  if (permissions.length === 0) {
    throw new Error("No valid permissions selected.");
  }

  const existingUserId = await User.findOne({ userId: data.account.userId.toLowerCase() });
  if (existingUserId) throw new Error("Staff ID already exists.");

  const existingEmail = await User.findOne({ email: data.personal.email.toLowerCase() });
  if (existingEmail) throw new Error("Email already registered.");

  const existingEmployee = await User.findOne(
    staffFilter(organizationId, { "professional.employeeId": data.professional.employeeId })
  );
  if (existingEmployee) throw new Error("Employee ID already exists in this organization.");

  const passwordHash = await hashPassword(data.account.password);

  const staff = await User.create({
    name: data.personal.name,
    userId: data.account.userId.toLowerCase(),
    email: data.personal.email.toLowerCase(),
    passwordHash,
    role: "STAFF",
    permissions,
    organizationId: org._id,
    status: "ACTIVE",
    mustChangePassword: true,
    profile: {
      phone: data.personal.phone,
      dateOfBirth: data.personal.dateOfBirth,
      gender: data.personal.gender,
      address: data.personal.address,
      photo: data.personal.photo,
      emergencyContactName: data.personal.emergencyContactName,
      emergencyContactPhone: data.personal.emergencyContactPhone,
    },
    professional: {
      employeeId: data.professional.employeeId,
      jobTitle: data.professional.jobTitle,
      jobTitleOther: "",
      department: data.professional.department,
      designation: data.professional.designation,
      employmentType: data.professional.employmentType,
      joiningDate: data.professional.joiningDate,
      responsibilities: data.professional.responsibilities,
    },
    passwordChangedAt: null,
  });

  org.lastActivityAt = new Date();
  await org.save();

  return {
    staff: toStaffSummary(staff),
    temporaryPassword: data.account.password,
    organizationName: org.basicInformation.name,
    organizationPublicId: org.organizationId,
  };
}

export function toStaffSummary(staff: IUser | Record<string, unknown>) {
  const s = staff as IUser;
  return {
    id: s._id.toString(),
    name: s.name,
    userId: s.userId,
    email: s.email,
    status: s.status,
    role: s.role,
    permissions: s.permissions,
    profile: s.profile,
    professional: s.professional,
    organizationId: s.organizationId?.toString() ?? null,
    lastLogin: s.lastLogin?.toISOString() ?? null,
    lastActive: s.lastActive?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    mustChangePassword: s.mustChangePassword,
    failedLoginAttempts: s.failedLoginAttempts,
    lockedUntil: s.lockedUntil?.toISOString() ?? null,
    passwordChangedAt: s.passwordChangedAt?.toISOString() ?? null,
  };
}

export async function listStaffMembers(
  organizationId: string,
  params: {
    q?: string;
    status?: string;
    department?: string;
    position?: string;
    online?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: "asc" | "desc";
  } = {}
) {
  await connectDB();
  const { platformConfig } = await import("@/lib/config/platform");
  const threshold = new Date(Date.now() - platformConfig.onlineThresholdSeconds * 1000);

  const filter: Record<string, unknown> = staffFilter(organizationId);

  if (params.status && params.status !== "ALL") filter.status = params.status;
  if (params.department && params.department !== "ALL") {
    filter["professional.department"] = params.department;
  }
  if (params.position && params.position !== "ALL") {
    filter["professional.jobTitle"] = params.position;
  }
  if (params.online === "online") {
    filter.lastActive = { $gte: threshold };
    filter.status = "ACTIVE";
  } else if (params.online === "offline") {
    filter.$or = [
      { lastActive: { $lt: threshold } },
      { lastActive: null },
    ];
  }

  if (params.q?.trim()) {
    const q = params.q.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { userId: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { "professional.employeeId": { $regex: q, $options: "i" } },
      { "professional.department": { $regex: q, $options: "i" } },
    ];
  }

  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;
  const sortField =
    params.sort === "name"
      ? "name"
      : params.sort === "status"
        ? "status"
        : params.sort === "lastLogin"
          ? "lastLogin"
          : "createdAt";
  const sortOrder = params.order === "asc" ? 1 : -1;

  const [staffList, total] = await Promise.all([
    User.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    staff: staffList.map((s) => ({
      ...toStaffSummary(s),
      isOnline: Boolean(s.lastActive && s.lastActive >= threshold && s.status === "ACTIVE"),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getStaffStatistics(organizationId: string) {
  await connectDB();
  const { platformConfig } = await import("@/lib/config/platform");
  const threshold = new Date(Date.now() - platformConfig.onlineThresholdSeconds * 1000);
  const base = staffFilter(organizationId);

  const [statusCounts, online] = await Promise.all([
    User.aggregate([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    User.countDocuments({ ...base, status: "ACTIVE", lastActive: { $gte: threshold } }),
  ]);

  const map = Object.fromEntries(statusCounts.map((s: { _id: string; count: number }) => [s._id, s.count]));
  const total = Object.values(map).reduce((a: number, b: number) => a + b, 0);
  const active = map.ACTIVE ?? 0;

  return {
    total,
    active,
    inactive: map.INACTIVE ?? 0,
    suspended: map.SUSPENDED ?? 0,
    pending: map.PENDING ?? 0,
    online,
    offline: Math.max(0, active - online),
  };
}

export async function getStaffById(organizationId: string, staffId: string) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(staffId)) return null;
  const staff = await User.findOne(staffFilter(organizationId, { _id: staffId }));
  if (!staff) return null;
  return toStaffSummary(staff);
}

export async function updateStaffMember(
  organizationId: string,
  staffId: string,
  admin: IUser,
  data: StaffUpdateInput
) {
  await connectDB();
  const staff = await User.findOne(staffFilter(organizationId, { _id: staffId }));
  if (!staff) return null;

  if (data.personal) {
    if (data.personal.email && data.personal.email.toLowerCase() !== staff.email) {
      const existing = await User.findOne({ email: data.personal.email.toLowerCase() });
      if (existing) throw new Error("Email already registered.");
      staff.email = data.personal.email.toLowerCase();
    }
    if (data.personal.name) staff.name = data.personal.name;
    staff.profile = { ...staff.profile, ...data.personal };
  }

  if (data.professional) {
    if (
      data.professional.employeeId &&
      data.professional.employeeId !== staff.professional.employeeId
    ) {
      const existing = await User.findOne(
        staffFilter(organizationId, {
          "professional.employeeId": data.professional.employeeId,
          _id: { $ne: staff._id },
        })
      );
      if (existing) throw new Error("Employee ID already exists in this organization.");
    }
    staff.professional = { ...staff.professional, ...data.professional };
  }

  if (data.permissions) {
    staff.permissions = filterAssignableStaffPermissions(admin.permissions, data.permissions);
  }

  await staff.save();
  return toStaffSummary(staff);
}

export async function updateStaffStatus(
  organizationId: string,
  staffId: string,
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
  action?: "activate" | "suspend" | "unlock"
) {
  await connectDB();
  const staff = await User.findOne(staffFilter(organizationId, { _id: staffId }));
  if (!staff) return null;

  if (action === "unlock") {
    staff.failedLoginAttempts = 0;
    staff.lockedUntil = null;
    if (staff.status === "LOCKED") staff.status = "ACTIVE";
  } else {
    staff.status = status;
  }

  await staff.save();
  return toStaffSummary(staff);
}

export async function resetStaffPassword(
  organizationId: string,
  staffId: string,
  newPassword: string
) {
  await connectDB();
  const staff = await User.findOne(staffFilter(organizationId, { _id: staffId })).select("+passwordHash");
  if (!staff) return null;

  staff.passwordHash = await hashPassword(newPassword);
  staff.mustChangePassword = true;
  staff.passwordChangedAt = null;
  staff.failedLoginAttempts = 0;
  staff.lockedUntil = null;
  await staff.save();

  return { staff: toStaffSummary(staff), temporaryPassword: newPassword };
}

export async function getStaffDepartments(organizationId: string) {
  await connectDB();
  const deps = await User.distinct("professional.department", staffFilter(organizationId));
  return deps.filter(Boolean).sort();
}
