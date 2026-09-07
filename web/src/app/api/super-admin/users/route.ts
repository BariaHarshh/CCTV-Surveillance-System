import { z } from "zod";
import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { platformConfig } from "@/lib/config/platform";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";
import mongoose from "mongoose";

const querySchema = z.object({
  q: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF", "ALL"]).optional().default("ALL"),
  status: z.string().optional(),
  online: z.enum(["online", "offline", "all"]).optional().default("all"),
  organizationId: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
  sort: z.enum(["name", "createdAt", "lastLogin"]).optional().default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    await requireSuperAdmin();

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return handleApiError(new Error(parsed.error.issues[0]?.message ?? "Invalid query"));
    }

    const { q, role, status, online, organizationId, page, limit, sort, order } = parsed.data;
    const filter: Record<string, unknown> = {};

    if (role !== "ALL") filter.role = role;
    if (status && status !== "ALL") filter.status = status;
    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }

    if (online === "online") {
      filter.lastActive = {
        $gte: new Date(Date.now() - platformConfig.onlineThresholdSeconds * 1000),
      };
      filter.status = "ACTIVE";
    } else if (online === "offline") {
      filter.$or = [
        { lastActive: { $lt: new Date(Date.now() - platformConfig.onlineThresholdSeconds * 1000) } },
        { lastActive: null },
      ];
    }

    if (q?.trim()) {
      const search = q.trim();
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortField = sort === "name" ? "name" : sort === "lastLogin" ? "lastLogin" : "createdAt";
    const sortOrder = order === "asc" ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const orgIds = users
      .map((u) => u.organizationId)
      .filter(Boolean) as mongoose.Types.ObjectId[];
    const orgs = await Organization.find({ _id: { $in: orgIds } }).lean();
    const orgMap = Object.fromEntries(
      orgs.map((o) => [o._id.toString(), o.basicInformation?.name ?? "Unknown"])
    );

    const threshold = new Date(Date.now() - platformConfig.onlineThresholdSeconds * 1000);

    return apiSuccess({
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        userId: u.userId,
        email: u.email,
        role: u.role,
        status: u.status,
        organizationId: u.organizationId?.toString() ?? null,
        organizationName: u.organizationId ? orgMap[u.organizationId.toString()] ?? "Unknown" : "Platform",
        lastLogin: u.lastLogin?.toISOString() ?? null,
        lastActive: u.lastActive?.toISOString() ?? null,
        isOnline: Boolean(u.lastActive && u.lastActive >= threshold && u.status === "ACTIVE"),
        createdAt: u.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
