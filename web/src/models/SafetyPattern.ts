import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { PATTERN_STATUSES, PATTERN_TYPES } from "@/lib/analytics/constants";

export interface ISafetyPattern extends Document {
  _id: Types.ObjectId;
  patternId: string;
  organizationId: Types.ObjectId;
  type: (typeof PATTERN_TYPES)[number];
  description: string;
  locations: string[];
  eventTypes: string[];
  frequency: number;
  severity: string;
  confidence: number;
  confidenceLabel: string;
  firstObserved: Date;
  lastObserved: Date;
  status: (typeof PATTERN_STATUSES)[number];
  relatedEventIds: Types.ObjectId[];
  metadata: Record<string, unknown>;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const SafetyPatternSchema = new Schema<ISafetyPattern>(
  {
    patternId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    type: { type: String, enum: PATTERN_TYPES, required: true },
    description: { type: String, required: true },
    locations: [{ type: String }],
    eventTypes: [{ type: String }],
    frequency: { type: Number, default: 0 },
    severity: { type: String, default: "MEDIUM" },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    confidenceLabel: { type: String, default: "Low" },
    firstObserved: { type: Date, required: true },
    lastObserved: { type: Date, required: true },
    status: { type: String, enum: PATTERN_STATUSES, default: "ACTIVE" },
    relatedEventIds: [{ type: Schema.Types.ObjectId, ref: "Event" }],
    metadata: { type: Schema.Types.Mixed, default: {} },
    source: { type: String, default: "SYSTEM" },
  },
  { timestamps: true }
);

SafetyPatternSchema.index({ organizationId: 1, type: 1, status: 1 });

export const SafetyPattern: Model<ISafetyPattern> =
  mongoose.models.SafetyPattern ?? mongoose.model<ISafetyPattern>("SafetyPattern", SafetyPatternSchema);
