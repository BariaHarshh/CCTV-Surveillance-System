import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Notification } from "@/models/Notification";
import { getNextSequence, formatNotificationId } from "@/models/Counter";
import { broadcastNotificationCreated } from "@/lib/monitoring/socket-emitter";
import type { NotificationType, SeverityLevel } from "@/lib/monitoring/constants";
import { queuePushDelivery } from "@/lib/mobile/push-service";

export async function createNotification(input: {
  organizationId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  severity?: SeverityLevel;
  metadata?: Record<string, unknown>;
  category?: string;
  testMode?: boolean;
}) {
  await connectDB();
  const seq = await getNextSequence("notification");
  const notification = await Notification.create({
    notificationId: await formatNotificationId(seq),
    organizationId: new mongoose.Types.ObjectId(input.organizationId),
    userId: input.userId ? new mongoose.Types.ObjectId(input.userId) : null,
    type: input.type,
    title: input.testMode ? `[TEST] ${input.title}` : input.title,
    message: input.message,
    severity: input.severity ?? "MEDIUM",
    metadata: {
      ...(input.metadata || {}),
      category: input.category ?? input.type,
      testMode: Boolean(input.testMode),
    },
  });

  const publicN = {
    id: notification._id.toString(),
    notificationId: notification.notificationId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    severity: notification.severity,
    read: false,
    createdAt: notification.createdAt.toISOString(),
    metadata: notification.metadata,
  };
  broadcastNotificationCreated(input.organizationId, publicN);

  await queuePushDelivery({
    organizationId: input.organizationId,
    userId: input.userId ?? null,
    notificationId: notification.notificationId,
    title: publicN.title,
    /** Keep preview non-sensitive */
    preview: publicN.title.slice(0, 80),
    category: String(input.category ?? input.type),
    testMode: Boolean(input.testMode),
  });

  return publicN;
}
