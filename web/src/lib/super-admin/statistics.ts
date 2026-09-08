import { connectDB } from "@/lib/db/connect";
import { platformConfig } from "@/lib/config/platform";
import { User } from "@/models/User";
import { Session } from "@/models/Session";
import { Organization } from "@/models/Organization";
import { AuthActivity } from "@/models/AuthActivity";
import { AuditLog } from "@/models/AuditLog";

function onlineThresholdDate(): Date {
  return new Date(Date.now() - platformConfig.onlineThresholdSeconds * 1000);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getPlatformStatistics() {
  await connectDB();

  const threshold = onlineThresholdDate();
  const today = startOfToday();

  const [
    userStatusCounts,
    roleCounts,
    orgStatusCounts,
    onlineUsers,
    activeSessions,
    failedLoginsToday,
    lockedAccounts,
    securityEventsToday,
  ] = await Promise.all([
    User.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    Organization.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    User.countDocuments({ lastActive: { $gte: threshold }, status: "ACTIVE" }),
    Session.countDocuments({ isValid: true, expiresAt: { $gt: new Date() } }),
    AuthActivity.countDocuments({ type: "LOGIN_FAILED", createdAt: { $gte: today } }),
    User.countDocuments({
      $or: [{ status: "LOCKED" }, { lockedUntil: { $gt: new Date() } }],
    }),
    AuditLog.countDocuments({
      severity: { $in: ["warning", "critical"] },
      createdAt: { $gte: today },
    }),
  ]);

  const statusMap = Object.fromEntries(
    userStatusCounts.map((s: { _id: string; count: number }) => [s._id, s.count])
  );
  const roleMap = Object.fromEntries(
    roleCounts.map((r: { _id: string; count: number }) => [r._id, r.count])
  );
  const orgMap = Object.fromEntries(
    orgStatusCounts.map((o: { _id: string; count: number }) => [o._id, o.count])
  );

  const totalOrganizations = await Organization.countDocuments({ deletedAt: null });

  const totalUsers = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const totalAdmins = roleMap.ADMIN ?? 0;
  const totalStaff = roleMap.STAFF ?? 0;
  const totalSuperAdmins = roleMap.SUPER_ADMIN ?? 0;

  const activeUsers = statusMap.ACTIVE ?? 0;
  const inactiveUsers = statusMap.INACTIVE ?? 0;
  const suspendedUsers = statusMap.SUSPENDED ?? 0;
  const pendingUsers = statusMap.PENDING ?? 0;
  const lockedUsers = statusMap.LOCKED ?? 0;

  const offlineUsers = Math.max(0, activeUsers - onlineUsers);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      suspended: suspendedUsers,
      pending: pendingUsers,
      locked: lockedUsers,
      online: onlineUsers,
      offline: offlineUsers,
      superAdmins: totalSuperAdmins,
      admins: totalAdmins,
      staff: totalStaff,
      platformUsers: totalAdmins + totalStaff + totalSuperAdmins,
    },
    userStatusChart: [
      { name: "Active", value: activeUsers, color: "#34d399" },
      { name: "Inactive", value: inactiveUsers, color: "#94a3b8" },
      { name: "Suspended", value: suspendedUsers, color: "#f87171" },
      { name: "Pending", value: pendingUsers, color: "#fbbf24" },
      { name: "Locked", value: lockedUsers, color: "#fb923c" },
    ],
    onlineChart: [
      { name: "Online", value: onlineUsers, color: "#38bdf8" },
      { name: "Offline", value: offlineUsers, color: "#475569" },
    ],
    organizations: {
      total: totalOrganizations,
      active: orgMap.ACTIVE ?? 0,
      inactive: orgMap.INACTIVE ?? 0,
      pending: orgMap.PENDING ?? 0,
      suspended: orgMap.SUSPENDED ?? 0,
    },
    admins: {
      total: totalAdmins,
      active: await User.countDocuments({ role: "ADMIN", status: "ACTIVE" }),
      inactive: await User.countDocuments({ role: "ADMIN", status: "INACTIVE" }),
      suspended: await User.countDocuments({ role: "ADMIN", status: "SUSPENDED" }),
    },
    security: {
      failedLoginsToday,
      lockedAccounts,
      activeSessions,
      securityEventsToday,
    },
  };
}

export async function getRecentActivity(limit = 20) {
  await connectDB();

  const [auditLogs, authActivities] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean(),
    AuthActivity.find().sort({ createdAt: -1 }).limit(limit).lean(),
  ]);

  const combined = [
    ...auditLogs.map((log) => ({
      id: log._id.toString(),
      source: "audit" as const,
      action: log.action,
      description: log.description,
      actor: log.actorName,
      actorRole: log.actorRole,
      severity: log.severity,
      createdAt: log.createdAt.toISOString(),
    })),
    ...authActivities.map((act) => ({
      id: act._id.toString(),
      source: "auth" as const,
      action: act.type,
      description: formatAuthActivityDescription(act.type),
      actor: act.userId ? "User" : "Unknown",
      actorRole: "",
      severity: act.type === "LOGIN_FAILED" || act.type === "ACCOUNT_LOCKED" ? "warning" : "info",
      createdAt: act.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return combined;
}

function formatAuthActivityDescription(type: string): string {
  switch (type) {
    case "LOGIN_SUCCESS":
      return "User logged in successfully";
    case "LOGIN_FAILED":
      return "Failed login attempt detected";
    case "LOGOUT":
      return "User logged out";
    case "ACCOUNT_LOCKED":
      return "Account locked due to failed attempts";
    case "PASSWORD_RESET_REQUEST":
      return "Password reset requested";
    case "PASSWORD_CHANGED":
      return "Password changed";
    default:
      return type;
  }
}

export async function getOrganizationsList() {
  await connectDB();
  const { listOrganizations } = await import("@/lib/organizations/service");
  const { organizations } = await listOrganizations({ limit: 100 });
  return organizations;
}

export async function getAdminsList() {
  await connectDB();

  const admins = await User.find({ role: "ADMIN" })
    .sort({ lastLogin: -1 })
    .populate("organizationId", "basicInformation.name organizationId")
    .lean();

  return admins.map((admin) => {
    const org = admin.organizationId as { basicInformation?: { name?: string } } | null;
    return {
      id: admin._id.toString(),
      name: admin.name,
      userId: admin.userId,
      email: admin.email,
      status: admin.status,
      organization:
        org && typeof org === "object" && org.basicInformation?.name
          ? org.basicInformation.name
          : "Unassigned",
      lastLogin: admin.lastLogin?.toISOString() ?? null,
    };
  });
}

export async function getSystemHealthStatus() {
  let database: "connected" | "disconnected" = "disconnected";
  try {
    await connectDB();
    database = "connected";
  } catch {
    database = "disconnected";
  }

  const authentication = database === "connected" ? "operational" : "degraded";
  const api = "operational";
  const sessions = database === "connected" ? "operational" : "degraded";

  const allOperational =
    database === "connected" &&
    authentication === "operational" &&
    api === "operational" &&
    sessions === "operational";

  return {
    database,
    authentication,
    api,
    sessions,
    overall: allOperational ? "operational" : "degraded",
    checkedAt: new Date().toISOString(),
  };
}
