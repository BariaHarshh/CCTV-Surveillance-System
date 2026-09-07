import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { NOTIFICATION_TYPES, SEVERITY_LEVELS } from "@/lib/monitoring/constants";

export interface INotification extends Document {
  _id: Types.ObjectId;
  notificationId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId | null;
  type: (typeof NOTIFICATION_TYPES)[number];
  title: string;
  message: string;
  severity: (typeof SEVERITY_LEVELS)[number];
  read: boolean;
  readAt: Date | null;
  alertId: Types.ObjectId | null;
  eventId: Types.ObjectId | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    notificationId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "ALERT" },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    severity: { type: String, enum: SEVERITY_LEVELS, default: "LOW" },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    alertId: { type: Schema.Types.ObjectId, ref: "Alert", default: null },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

NotificationSchema.index({ organizationId: 1, userId: 1, read: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ?? mongoose.model<INotification>("Notification", NotificationSchema);
