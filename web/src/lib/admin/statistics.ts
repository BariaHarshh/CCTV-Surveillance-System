import { connectDB } from "@/lib/db/connect";
import { platformConfig } from "@/lib/config/platform";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";
import { AuditLog } from "@/models/AuditLog";
import { getStaffStatistics } from "@/lib/staff/service";
import { getCampusStatistics } from "@/lib/campus/service";
import { getCameraStatistics } from "@/lib/campus/camera-service";
import { getOrCreateCampus } from "@/lib/campus/service";
import { getMonitoringOverview } from "@/lib/monitoring/monitoring-stats";
import mongoose from "mongoose";

const ORG_STAFF_ACTIONS = [
  "STAFF_CREATED",
  "STAFF_UPDATED",
  "STAFF_ACTIVATED",
  "STAFF_SUSPENDED",
  "STAFF_UNLOCKED",
  "STAFF_PERMISSION_CHANGED",
  "STAFF_PASSWORD_RESET",
  "ADMIN_LOGIN",
  "STAFF_LOGIN",
  "PASSWORD_CHANGED",
  "PROFILE_UPDATED",
  "ORGANIZATION_VIEWED",
  "ORGANIZATION_UPDATED",
  "CAMPUS_UPDATED",
  "BUILDING_CREATED",
  "BUILDING_UPDATED",
  "CAMERA_CREATED",
  "CAMERA_TESTED",
] as const;

function onlineThresholdDate(): Date {
  return new Date(Date.now() - platformConfig.onlineThresholdSeconds * 1000);
}

export async function getAdminDashboardData(organizationId: string) {
  await connectDB();
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);

  const [organization, staffStats, campusUsers, recentActivity, campusDoc, cameraStats, monitoringOverview] = await Promise.all([
    Organization.findOne({ _id: orgObjectId, deletedAt: null }),
    getStaffStatistics(organizationId),
    User.countDocuments({
      organizationId: orgObjectId,
      role: { $in: ["ADMIN", "STAFF"] },
    }),
    getOrganizationActivity(organizationId, 15),
    getOrCreateCampus(organizationId).catch(() => null),
    getCameraStatistics(organizationId).catch(() => null),
    getMonitoringOverview(organizationId).catch(() => null),
  ]);

  let campusStats = null;
  if (campusDoc) {
    campusStats = await getCampusStatistics(organizationId, campusDoc._id.toString());
  }

  if (!organization) {
    throw new Error("Organization not found.");
  }

  return {
    organization: {
      id: organization._id.toString(),
      organizationId: organization.organizationId,
      name: organization.basicInformation.name,
      status: organization.status,
    },
    statistics: {
      staff: staffStats,
      campusUsers,
      activeAlerts: monitoringOverview?.alerts.unresolved ?? 0,
      criticalAlerts: monitoringOverview?.alerts.critical ?? 0,
      eventsToday: monitoringOverview?.events.today ?? 0,
      activeEvents: monitoringOverview?.events.active ?? 0,
      currentRisk: monitoringOverview?.currentRisk ?? { score: 0, level: "LOW", label: "No active risk" },
      organizationStatus: organization.status,
      campus: campusStats
        ? {
            buildings: campusStats.buildings,
            rooms: campusStats.rooms,
            cameras: campusStats.cameras,
            totalCapacity: campusStats.totalCapacity,
            occupancy: null,
            occupancyLabel: "AI Occupancy — Coming Soon",
          }
        : null,
      cameras: cameraStats ?? {
        total: 0,
        online: 0,
        offline: 0,
        maintenance: 0,
        error: 0,
        connecting: 0,
        disabled: 0,
      },
    },
    staffOverview: [
      { name: "Active", value: staffStats.active, color: "#34d399" },
      { name: "Inactive", value: staffStats.inactive, color: "#94a3b8" },
      { name: "Suspended", value: staffStats.suspended, color: "#f87171" },
      { name: "Online", value: staffStats.online, color: "#38bdf8" },
      { name: "Offline", value: staffStats.offline, color: "#475569" },
    ],
    activity: recentActivity,
    generatedAt: new Date().toISOString(),
  };
}

export async function getOrganizationActivity(organizationId: string, limit = 20) {
  await connectDB();

  const logs = await AuditLog.find({
    action: { $in: [...ORG_STAFF_ACTIONS] },
    "metadata.organizationId": organizationId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return logs.map((log) => ({
    id: log._id.toString(),
    action: log.action,
    description: log.description,
    actorName: log.actorName,
    actorRole: log.actorRole,
    targetLabel: log.targetLabel,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function searchOrganizationUsers(organizationId: string, query: string, limit = 8) {
  await connectDB();
  const q = query.trim();
  if (!q) return [];

  const filter = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    role: { $in: ["STAFF", "ADMIN"] as const },
    $or: [
      { name: { $regex: q, $options: "i" } },
      { userId: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { "professional.employeeId": { $regex: q, $options: "i" } },
      { "professional.department": { $regex: q, $options: "i" } },
    ],
  };

  const users = await User.find(filter).limit(limit).lean();
  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    userId: u.userId,
    role: u.role,
    department: u.professional?.department ?? "",
    status: u.status,
  }));
}

export { onlineThresholdDate };
