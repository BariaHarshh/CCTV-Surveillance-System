import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  EVENT_TYPES,
  EVENT_STATUSES,
  EVENT_SOURCES,
  SEVERITY_LEVELS,
} from "@/lib/monitoring/constants";

export interface IEventSnapshot {
  storageKey: string;
  contentType: string;
  capturedAt: Date;
}

export interface IEvent extends Document {
  _id: Types.ObjectId;
  eventId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId | null;
  buildingId: Types.ObjectId | null;
  roomId: Types.ObjectId | null;
  cameraId: Types.ObjectId | null;
  eventType: (typeof EVENT_TYPES)[number];
  severity: (typeof SEVERITY_LEVELS)[number];
  confidence: number | null;
  source: (typeof EVENT_SOURCES)[number];
  detectedAt: Date;
  status: (typeof EVENT_STATUSES)[number];
  riskScore: number;
  riskLevel: (typeof SEVERITY_LEVELS)[number];
  riskFactors: string[];
  metadata: Record<string, unknown>;
  snapshot: IEventSnapshot | null;
  locationLabel: string;
  createdAt: Date;
  updatedAt: Date;
}

const SnapshotSchema = new Schema<IEventSnapshot>(
  {
    storageKey: { type: String, required: true },
    contentType: { type: String, default: "image/jpeg" },
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EventSchema = new Schema<IEvent>(
  {
    eventId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", default: null },
    buildingId: { type: Schema.Types.ObjectId, ref: "Building", default: null },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", default: null },
    cameraId: { type: Schema.Types.ObjectId, ref: "Camera", default: null },
    eventType: { type: String, enum: EVENT_TYPES, required: true, index: true },
    severity: { type: String, enum: SEVERITY_LEVELS, default: "LOW" },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    source: { type: String, enum: EVENT_SOURCES, default: "DETECTION" },
    detectedAt: { type: Date, default: Date.now, index: true },
    status: { type: String, enum: EVENT_STATUSES, default: "OPEN", index: true },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: { type: String, enum: SEVERITY_LEVELS, default: "LOW" },
    riskFactors: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    snapshot: { type: SnapshotSchema, default: null },
    locationLabel: { type: String, default: "" },
  },
  { timestamps: true }
);

EventSchema.index({ organizationId: 1, detectedAt: -1 });
EventSchema.index({ organizationId: 1, eventType: 1, severity: 1 });

export const Event: Model<IEvent> =
  mongoose.models.Event ?? mongoose.model<IEvent>("Event", EventSchema);

// Re-export for backward compatibility
export const EVENT_SEVERITIES = SEVERITY_LEVELS;
