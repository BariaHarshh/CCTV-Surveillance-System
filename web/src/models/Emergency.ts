import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  CAMPUS_EMERGENCY_MODES,
  EMERGENCY_STATUSES,
  EMERGENCY_TYPES,
  type CampusEmergencyMode,
  type EmergencyStatus,
  type EmergencyType,
  type BuildingOpsStatus,
} from "@/lib/emergency/constants";
import { SEVERITY_LEVELS } from "@/lib/monitoring/constants";

export interface IEmergencyLocation {
  campus?: string;
  campusId?: string;
  building?: string;
  buildingId?: string;
  floor?: string;
  room?: string;
  roomId?: string;
  camera?: string;
  cameraId?: string;
  label?: string;
}

export interface IEmergencyTimelineEntry {
  action: string;
  description: string;
  actorId: Types.ObjectId | null;
  actorName: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface IEmergency extends Document {
  _id: Types.ObjectId;
  emergencyId: string;
  organizationId: Types.ObjectId;
  campusId: Types.ObjectId | null;
  type: EmergencyType;
  severity: (typeof SEVERITY_LEVELS)[number];
  status: EmergencyStatus;
  mode: CampusEmergencyMode;
  reason: string;
  description: string;
  location: IEmergencyLocation;
  affectedBuildingIds: Types.ObjectId[];
  incidentIds: Types.ObjectId[];
  alertIds: Types.ObjectId[];
  teamIds: Types.ObjectId[];
  playbookId: Types.ObjectId | null;
  timeline: IEmergencyTimelineEntry[];
  activatedBy: Types.ObjectId | null;
  activatedByName: string;
  activatedAt: Date;
  resolvedBy: Types.ObjectId | null;
  resolvedByName: string;
  resolvedAt: Date | null;
  notes: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<IEmergencyLocation>(
  {
    campus: String,
    campusId: String,
    building: String,
    buildingId: String,
    floor: String,
    room: String,
    roomId: String,
    camera: String,
    cameraId: String,
    label: String,
  },
  { _id: false }
);

const TimelineSchema = new Schema<IEmergencyTimelineEntry>(
  {
    action: { type: String, required: true },
    description: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "System" },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const EmergencySchema = new Schema<IEmergency>(
  {
    emergencyId: { type: String, required: true, unique: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", default: null },
    type: { type: String, enum: EMERGENCY_TYPES, required: true },
    severity: { type: String, enum: SEVERITY_LEVELS, default: "HIGH" },
    status: { type: String, enum: EMERGENCY_STATUSES, default: "ACTIVE", index: true },
    mode: { type: String, enum: CAMPUS_EMERGENCY_MODES, default: "EMERGENCY" },
    reason: { type: String, required: true },
    description: { type: String, default: "" },
    location: { type: LocationSchema, default: () => ({}) },
    affectedBuildingIds: [{ type: Schema.Types.ObjectId, ref: "Building" }],
    incidentIds: [{ type: Schema.Types.ObjectId, ref: "Incident" }],
    alertIds: [{ type: Schema.Types.ObjectId, ref: "Alert" }],
    teamIds: [{ type: Schema.Types.ObjectId, ref: "ResponseTeam" }],
    playbookId: { type: Schema.Types.ObjectId, ref: "Playbook", default: null },
    timeline: { type: [TimelineSchema], default: [] },
    activatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    activatedByName: { type: String, default: "" },
    activatedAt: { type: Date, default: Date.now },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedByName: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    source: { type: String, default: "MANUAL" },
  },
  { timestamps: true }
);

EmergencySchema.index({ organizationId: 1, status: 1, createdAt: -1 });

export const Emergency: Model<IEmergency> =
  mongoose.models.Emergency ?? mongoose.model<IEmergency>("Emergency", EmergencySchema);

/** Org-level emergency mode state (one doc per org) */
export interface IOrganizationEmergencyState extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  mode: CampusEmergencyMode;
  activeEmergencyId: Types.ObjectId | null;
  updatedAt: Date;
  createdAt: Date;
}

const OrgEmergencyStateSchema = new Schema<IOrganizationEmergencyState>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
    mode: { type: String, enum: CAMPUS_EMERGENCY_MODES, default: "NORMAL" },
    activeEmergencyId: { type: Schema.Types.ObjectId, ref: "Emergency", default: null },
  },
  { timestamps: true }
);

export const OrganizationEmergencyState: Model<IOrganizationEmergencyState> =
  mongoose.models.OrganizationEmergencyState ??
  mongoose.model<IOrganizationEmergencyState>("OrganizationEmergencyState", OrgEmergencyStateSchema);

export type { BuildingOpsStatus };
