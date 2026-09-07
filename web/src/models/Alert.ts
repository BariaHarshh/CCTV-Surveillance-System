import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { ALERT_STATUSES, SEVERITY_LEVELS } from "@/lib/monitoring/constants";

export interface IAlertLocation {
  campus?: string;
  campusId?: string;
  building?: string;
  buildingId?: string;
  room?: string;
  roomId?: string;
  camera?: string;
  cameraPublicId?: string;
}

export interface IAlert extends Document {
  _id: Types.ObjectId;
  alertId: string;
  organizationId: Types.ObjectId;
  eventId: Types.ObjectId | null;
  cameraId: Types.ObjectId | null;
  location: IAlertLocation;
  type: string;
  severity: (typeof SEVERITY_LEVELS)[number];
  riskScore: number;
  title: string;
  description: string;
  status: (typeof ALERT_STATUSES)[number];
  assignedTo: Types.ObjectId | null;
  assignedToName: string;
  acknowledgedBy: Types.ObjectId | null;
  acknowledgedByName: string;
  acknowledgedAt: Date | null;
  resolvedBy: Types.ObjectId | null;
  resolvedByName: string;
  resolvedAt: Date | null;
  dismissedBy: Types.ObjectId | null;
  dismissedAt: Date | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<IAlertLocation>(
  {
    campus: String,
    campusId: String,
    building: String,
    buildingId: String,
    room: String,
    roomId: String,
    camera: String,
    cameraPublicId: String,
  },
  { _id: false }
);

const AlertSchema = new Schema<IAlert>(
  {
    alertId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    cameraId: { type: Schema.Types.ObjectId, ref: "Camera", default: null },
    location: { type: LocationSchema, default: () => ({}) },
    type: { type: String, required: true },
    severity: { type: String, enum: SEVERITY_LEVELS, required: true },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ALERT_STATUSES, default: "NEW", index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedToName: { type: String, default: "" },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acknowledgedByName: { type: String, default: "" },
    acknowledgedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedByName: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    dismissedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dismissedAt: { type: Date, default: null },
    source: { type: String, default: "DETECTION" },
  },
  { timestamps: true }
);

AlertSchema.index({ organizationId: 1, createdAt: -1 });
AlertSchema.index({ organizationId: 1, status: 1, severity: 1 });

export const Alert: Model<IAlert> =
  mongoose.models.Alert ?? mongoose.model<IAlert>("Alert", AlertSchema);
