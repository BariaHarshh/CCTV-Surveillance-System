import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { ESCALATION_LEVELS } from "@/lib/emergency/constants";
import { SEVERITY_LEVELS } from "@/lib/monitoring/constants";

export interface IEscalationLevelConfig {
  level: (typeof ESCALATION_LEVELS)[number];
  roleLabel: string;
  timeoutMinutes: number;
  teamId?: Types.ObjectId | null;
}

export interface IEscalationRule extends Document {
  _id: Types.ObjectId;
  ruleId: string;
  organizationId: Types.ObjectId;
  name: string;
  eventTypes: string[];
  severity: (typeof SEVERITY_LEVELS)[number];
  levels: IEscalationLevelConfig[];
  timeoutMinutes: number;
  enabled: boolean;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IActiveEscalation extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  emergencyId: Types.ObjectId | null;
  incidentId: Types.ObjectId | null;
  alertId: Types.ObjectId | null;
  ruleId: Types.ObjectId | null;
  currentLevel: (typeof ESCALATION_LEVELS)[number];
  levelIndex: number;
  status: "ACTIVE" | "ACKNOWLEDGED" | "CLOSED" | "TIMED_OUT";
  nextEscalationAt: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: Types.ObjectId | null;
  acknowledgedByName: string;
  deliveryStatus: "PENDING" | "DELIVERED" | "FAILED";
  history: Array<{ level: string; triggeredAt: Date; notified: boolean }>;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const LevelConfigSchema = new Schema<IEscalationLevelConfig>(
  {
    level: { type: String, enum: ESCALATION_LEVELS, required: true },
    roleLabel: { type: String, default: "" },
    timeoutMinutes: { type: Number, default: 10 },
    teamId: { type: Schema.Types.ObjectId, ref: "ResponseTeam", default: null },
  },
  { _id: false }
);

const EscalationRuleSchema = new Schema<IEscalationRule>(
  {
    ruleId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    eventTypes: [{ type: String }],
    severity: { type: String, enum: SEVERITY_LEVELS, required: true },
    levels: { type: [LevelConfigSchema], default: [] },
    timeoutMinutes: { type: Number, default: 10 },
    enabled: { type: Boolean, default: true },
    source: { type: String, default: "MANUAL" },
  },
  { timestamps: true }
);

EscalationRuleSchema.index({ organizationId: 1, severity: 1 });

export const EscalationRule: Model<IEscalationRule> =
  mongoose.models.EscalationRule ?? mongoose.model<IEscalationRule>("EscalationRule", EscalationRuleSchema);

const ActiveEscalationSchema = new Schema<IActiveEscalation>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    emergencyId: { type: Schema.Types.ObjectId, ref: "Emergency", default: null },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", default: null },
    alertId: { type: Schema.Types.ObjectId, ref: "Alert", default: null },
    ruleId: { type: Schema.Types.ObjectId, ref: "EscalationRule", default: null },
    currentLevel: { type: String, enum: ESCALATION_LEVELS, default: "LEVEL_1" },
    levelIndex: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "ACKNOWLEDGED", "CLOSED", "TIMED_OUT"], default: "ACTIVE" },
    nextEscalationAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acknowledgedByName: { type: String, default: "" },
    deliveryStatus: { type: String, enum: ["PENDING", "DELIVERED", "FAILED"], default: "PENDING" },
    history: [
      {
        level: String,
        triggeredAt: { type: Date, default: Date.now },
        notified: { type: Boolean, default: false },
      },
    ],
    source: { type: String, default: "SYSTEM" },
  },
  { timestamps: true }
);

ActiveEscalationSchema.index({ organizationId: 1, status: 1, nextEscalationAt: 1 });

export const ActiveEscalation: Model<IActiveEscalation> =
  mongoose.models.ActiveEscalation ?? mongoose.model<IActiveEscalation>("ActiveEscalation", ActiveEscalationSchema);
