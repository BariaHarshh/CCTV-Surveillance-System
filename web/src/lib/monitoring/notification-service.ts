import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Notification } from "@/models/Notification";
import { getNextSequence, formatNotificationId } from "@/models/Counter";
import { orgFilter } from "@/lib/campus/service";
import { broadcastNotificationCreated } from "@/lib/monitoring/socket-emitter";
import type { IAlertLocation } from "@/models/Alert";
import type { SeverityLevel } from "@/lib/monitoring/constants";

function toNotificationPublic(n: Record<string, unknown> | object) {
  const doc = n as {
    _id: { toString(): string };
    notificationId: string;
    organizationId: { toString(): string };
    userId: { toString(): string } | null;
    type: string;
    title: string;
    message: string;
    severity: string;
    read: boolean;
    readAt: Date | null;
    alertId: { toString(): string } | null;
    eventId: { toString(): string } | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
  };
  return {
    id: doc._id.toString(),
    notificationId: doc.notificationId,
    organizationId: doc.organizationId.toString(),
    userId: doc.userId?.toString() ?? null,
    type: doc.type,
    title: doc.title,
    message: doc.message,
    severity: doc.severity,
    read: doc.read,
    readAt: doc.readAt?.toISOString() ?? null,
    alertId: doc.alertId?.toString() ?? null,
    eventId: doc.eventId?.toString() ?? null,
    metadata: doc.metadata,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createNotificationForAlert(
  organizationId: string,
  alert: { id: string; alertId: string; title: string; severity: string; location: IAlertLocation },
  userId: string | null
) {
  await connectDB();
  const seq = await getNextSequence("notification");
  const notification = await Notification.create({
    notificationId: await formatNotificationId(seq),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: userId ? new mongoose.Types.ObjectId(userId) : null,
    type: "ALERT",
    title: alert.severity === "CRITICAL" ? `NEW CRITICAL ALERT` : `New Alert: ${alert.title}`,
    message: `${alert.title} — ${alert.location?.building ?? alert.location?.camera ?? "Campus"}`,
    severity: alert.severity as SeverityLevel,
    alertId: new mongoose.Types.ObjectId(alert.id),
    metadata: { alertId: alert.alertId, location: alert.location },
  });

  const publicN = toNotificationPublic(notification.toObject());
  broadcastNotificationCreated(organizationId, publicN);
  return publicN;
}

export async function listNotifications(organizationId: string, userId: string, params?: { unreadOnly?: boolean }) {
  await connectDB();
  const filter: Record<string, unknown> = {
    ...orgFilter(organizationId),
    $or: [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: null }],
  };
  if (params?.unreadOnly) filter.read = false;

  const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(100);
  const unread = await Notification.countDocuments({ ...filter, read: false });

  return {
    notifications: notifications.map((n) => toNotificationPublic(n.toObject())),
    unread,
  };
}

export async function markNotificationRead(organizationId: string, userId: string, id: string) {
  await connectDB();
  const n = await Notification.findOne({
    ...orgFilter(organizationId, { _id: id }),
    $or: [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: null }],
  });
  if (!n) return null;
  n.read = true;
  n.readAt = new Date();
  await n.save();
  return toNotificationPublic(n.toObject());
}

export async function markAllNotificationsRead(organizationId: string, userId: string) {
  await connectDB();
  await Notification.updateMany(
    {
      ...orgFilter(organizationId),
      read: false,
      $or: [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: null }],
    },
    { $set: { read: true, readAt: new Date() } }
  );
  return { success: true };
}
