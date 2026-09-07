import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  ANNOUNCEMENT_KINDS,
  CERT_STATUSES,
  CHECKIN_STATUSES,
  EQUIPMENT_STATUSES,
  FIELD_STAFF_STATUSES,
  INSPECTION_RESULT_STATUSES,
  INSPECTION_RUN_STATUSES,
  MESSAGE_CHANNEL_KINDS,
  MESSAGE_STATUSES,
  OFFLINE_OPS,
  PATROL_RUN_STATUSES,
  PUSH_DELIVERY_STATES,
  SYNC_CONFLICT_RESOLUTIONS,
} from "@/lib/mobile/constants";

export { newMobileId } from "@/lib/mobile/constants";

/* ─── Field staff duty status (per user; audited) ─── */
export interface IFieldStaffPresence extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  status: (typeof FIELD_STAFF_STATUSES)[number];
  note: string;
  locationSharingEnabled: boolean;
  lastLocation: {
    lat: number | null;
    lng: number | null;
    accuracyM: number | null;
    updatedAt: Date | null;
  };
  demo: boolean;
  updatedAt: Date;
  createdAt: Date;
}

const FieldStaffPresenceSchema = new Schema<IFieldStaffPresence>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: { type: String, enum: FIELD_STAFF_STATUSES, default: "AVAILABLE" },
    note: { type: String, default: "" },
    locationSharingEnabled: { type: Boolean, default: false },
    lastLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracyM: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
FieldStaffPresenceSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export const FieldStaffPresence: Model<IFieldStaffPresence> =
  mongoose.models.FieldStaffPresence ??
  mongoose.model<IFieldStaffPresence>("FieldStaffPresence", FieldStaffPresenceSchema);

/* ─── Emergency / field check-in ─── */
export interface IFieldCheckIn extends Document {
  checkInId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  emergencyId: Types.ObjectId | null;
  status: (typeof CHECKIN_STATUSES)[number];
  note: string;
  location: { lat: number | null; lng: number | null; accuracyM: number | null };
  demo: boolean;
  createdAt: Date;
}

const FieldCheckInSchema = new Schema<IFieldCheckIn>(
  {
    checkInId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    userName: { type: String, default: "" },
    emergencyId: { type: Schema.Types.ObjectId, default: null, index: true },
    status: { type: String, enum: CHECKIN_STATUSES, required: true },
    note: { type: String, default: "" },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracyM: { type: Number, default: null },
    },
    demo: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const FieldCheckIn: Model<IFieldCheckIn> =
  mongoose.models.FieldCheckIn ?? mongoose.model<IFieldCheckIn>("FieldCheckIn", FieldCheckInSchema);

/* ─── Operational communication channels ─── */
export interface IOpsChannel extends Document {
  channelId: string;
  organizationId: Types.ObjectId;
  kind: (typeof MESSAGE_CHANNEL_KINDS)[number];
  refId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const OpsChannelSchema = new Schema<IOpsChannel>(
  {
    channelId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, enum: MESSAGE_CHANNEL_KINDS, required: true },
    refId: { type: String, required: true },
    title: { type: String, default: "" },
  },
  { timestamps: true }
);
OpsChannelSchema.index({ organizationId: 1, kind: 1, refId: 1 }, { unique: true });

export const OpsChannel: Model<IOpsChannel> =
  mongoose.models.OpsChannel ?? mongoose.model<IOpsChannel>("OpsChannel", OpsChannelSchema);

export interface IOpsMessage extends Document {
  messageId: string;
  organizationId: Types.ObjectId;
  channelId: string;
  senderId: Types.ObjectId | null;
  senderName: string;
  content: string;
  originalContent: string | null;
  attachments: Array<{ kind?: string; type?: string; ref: string; name: string }>;
  isSystemEvent: boolean;
  status: (typeof MESSAGE_STATUSES)[number];
  editedAt: Date | null;
  editedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
  deleteReason: string | null;
  demo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OpsMessageSchema = new Schema<IOpsMessage>(
  {
    messageId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, default: null },
    senderName: { type: String, default: "System" },
    content: { type: String, required: true },
    originalContent: { type: String, default: null },
    attachments: {
      type: [
        {
          kind: { type: String },
          ref: { type: String },
          name: { type: String },
        },
      ],
      default: [],
    },
    isSystemEvent: { type: Boolean, default: false },
    status: { type: String, enum: MESSAGE_STATUSES, default: "VISIBLE" },
    editedAt: { type: Date, default: null },
    editedBy: { type: Schema.Types.ObjectId, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, default: null },
    deleteReason: { type: String, default: null },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const OpsMessage: Model<IOpsMessage> =
  mongoose.models.OpsMessage ?? mongoose.model<IOpsMessage>("OpsMessage", OpsMessageSchema);

/* ─── Announcements ─── */
export interface IAnnouncement extends Document {
  announcementId: string;
  organizationId: Types.ObjectId;
  kind: (typeof ANNOUNCEMENT_KINDS)[number];
  title: string;
  body: string;
  severity: string;
  targets: {
    campusIds: string[];
    buildingIds: string[];
    departments: string[];
    roles: string[];
    teamIds: string[];
  };
  startsAt: Date;
  expiresAt: Date | null;
  createdBy: Types.ObjectId | null;
  testMode: boolean;
  demo: boolean;
  createdAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    announcementId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, enum: ANNOUNCEMENT_KINDS, default: "GENERAL" },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    severity: { type: String, default: "NORMAL" },
    targets: {
      campusIds: { type: [String], default: [] },
      buildingIds: { type: [String], default: [] },
      departments: { type: [String], default: [] },
      roles: { type: [String], default: [] },
      teamIds: { type: [String], default: [] },
    },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    testMode: { type: Boolean, default: false },
    demo: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ?? mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);

/* ─── Skills / certifications ─── */
export interface IStaffSkill extends Document {
  skillId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  level: string;
  createdAt: Date;
}

const StaffSkillSchema = new Schema<IStaffSkill>(
  {
    skillId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    level: { type: String, default: "BASIC" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StaffSkill: Model<IStaffSkill> =
  mongoose.models.StaffSkill ?? mongoose.model<IStaffSkill>("StaffSkill", StaffSkillSchema);

export interface IStaffCertification extends Document {
  certificationId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  status: (typeof CERT_STATUSES)[number];
  createdAt: Date;
}

const StaffCertificationSchema = new Schema<IStaffCertification>(
  {
    certificationId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    issuedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: CERT_STATUSES, default: "UNKNOWN" },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const StaffCertification: Model<IStaffCertification> =
  mongoose.models.StaffCertification ??
  mongoose.model<IStaffCertification>("StaffCertification", StaffCertificationSchema);

/* ─── Equipment ─── */
export interface IFieldEquipment extends Document {
  equipmentId: string;
  organizationId: Types.ObjectId;
  name: string;
  kind: string;
  status: (typeof EQUIPMENT_STATUSES)[number];
  assignedUserId: Types.ObjectId | null;
  assignedTeamId: Types.ObjectId | null;
  locationLabel: string;
  createdAt: Date;
  updatedAt: Date;
}

const FieldEquipmentSchema = new Schema<IFieldEquipment>(
  {
    equipmentId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    kind: { type: String, default: "GENERAL" },
    status: { type: String, enum: EQUIPMENT_STATUSES, default: "AVAILABLE" },
    assignedUserId: { type: Schema.Types.ObjectId, default: null },
    assignedTeamId: { type: Schema.Types.ObjectId, default: null },
    locationLabel: { type: String, default: "" },
  },
  { timestamps: true }
);

export const FieldEquipment: Model<IFieldEquipment> =
  mongoose.models.FieldEquipment ??
  mongoose.model<IFieldEquipment>("FieldEquipment", FieldEquipmentSchema);

export interface IEquipmentTxn extends Document {
  txnId: string;
  organizationId: Types.ObjectId;
  equipmentId: string;
  action: "CHECKOUT" | "RETURN" | "MAINTENANCE";
  actorId: Types.ObjectId | null;
  note: string;
  createdAt: Date;
}

const EquipmentTxnSchema = new Schema<IEquipmentTxn>(
  {
    txnId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    equipmentId: { type: String, required: true },
    action: { type: String, enum: ["CHECKOUT", "RETURN", "MAINTENANCE"], required: true },
    actorId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const EquipmentTxn: Model<IEquipmentTxn> =
  mongoose.models.EquipmentTxn ?? mongoose.model<IEquipmentTxn>("EquipmentTxn", EquipmentTxnSchema);

/* ─── Checklists / inspections ─── */
export interface IFieldChecklistTemplate extends Document {
  checklistId: string;
  organizationId: Types.ObjectId;
  name: string;
  kind: string;
  items: Array<{ key: string; label: string }>;
  createdAt: Date;
}

const FieldChecklistTemplateSchema = new Schema<IFieldChecklistTemplate>(
  {
    checklistId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    kind: { type: String, default: "GENERAL" },
    items: { type: [{ key: String, label: String }], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const FieldChecklistTemplate: Model<IFieldChecklistTemplate> =
  mongoose.models.FieldChecklistTemplate ??
  mongoose.model<IFieldChecklistTemplate>("FieldChecklistTemplate", FieldChecklistTemplateSchema);

export interface IInspectionRun extends Document {
  inspectionId: string;
  organizationId: Types.ObjectId;
  checklistId: string;
  title: string;
  locationLabel: string;
  inspectorId: Types.ObjectId | null;
  inspectorName: string;
  status: (typeof INSPECTION_RUN_STATUSES)[number];
  result: (typeof INSPECTION_RESULT_STATUSES)[number] | null;
  notes: string;
  dueAt: Date | null;
  completedAt: Date | null;
  followUpTaskId: string | null;
  items: Array<{ key: string; label: string; result: string | null; note: string }>;
  demo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InspectionRunSchema = new Schema<IInspectionRun>(
  {
    inspectionId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    checklistId: { type: String, default: "" },
    title: { type: String, required: true },
    locationLabel: { type: String, default: "" },
    inspectorId: { type: Schema.Types.ObjectId, default: null },
    inspectorName: { type: String, default: "" },
    status: { type: String, enum: INSPECTION_RUN_STATUSES, default: "SCHEDULED" },
    result: {
      type: String,
      enum: ["PASS", "FAIL", "WARNING", "NOT_APPLICABLE"],
      default: null,
    },
    notes: { type: String, default: "" },
    dueAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    followUpTaskId: { type: String, default: null },
    items: {
      type: [{ key: String, label: String, result: String, note: String }],
      default: [],
    },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const InspectionRun: Model<IInspectionRun> =
  mongoose.models.InspectionRun ?? mongoose.model<IInspectionRun>("InspectionRun", InspectionRunSchema);

/* ─── Patrol ─── */
export interface IPatrolRoute extends Document {
  routeId: string;
  organizationId: Types.ObjectId;
  name: string;
  checkpoints: Array<{
    checkpointId: string;
    label: string;
    locationLabel: string;
    expectedMinutes: number | null;
    qrToken: string;
  }>;
  createdAt: Date;
}

const PatrolRouteSchema = new Schema<IPatrolRoute>(
  {
    routeId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    checkpoints: {
      type: [
        {
          checkpointId: String,
          label: String,
          locationLabel: String,
          expectedMinutes: Number,
          qrToken: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const PatrolRoute: Model<IPatrolRoute> =
  mongoose.models.PatrolRoute ?? mongoose.model<IPatrolRoute>("PatrolRoute", PatrolRouteSchema);

export interface IPatrolRun extends Document {
  patrolId: string;
  organizationId: Types.ObjectId;
  routeId: string;
  routeName: string;
  assignedUserId: Types.ObjectId | null;
  assignedTeamId: Types.ObjectId | null;
  status: (typeof PATROL_RUN_STATUSES)[number];
  startedAt: Date | null;
  completedAt: Date | null;
  checks: Array<{
    checkpointId: string;
    at: Date | null;
    note: string;
    missed: boolean;
  }>;
  demo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PatrolRunSchema = new Schema<IPatrolRun>(
  {
    patrolId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    routeId: { type: String, required: true },
    routeName: { type: String, default: "" },
    assignedUserId: { type: Schema.Types.ObjectId, default: null },
    assignedTeamId: { type: Schema.Types.ObjectId, default: null },
    status: { type: String, enum: PATROL_RUN_STATUSES, default: "SCHEDULED" },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    checks: {
      type: [{ checkpointId: String, at: Date, note: String, missed: Boolean }],
      default: [],
    },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PatrolRun: Model<IPatrolRun> =
  mongoose.models.PatrolRun ?? mongoose.model<IPatrolRun>("PatrolRun", PatrolRunSchema);

/* ─── Offline sync queue (server-side record of client outbox) ─── */
export interface IOfflineSyncItem extends Document {
  syncId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  clientOpId: string;
  operation: (typeof OFFLINE_OPS)[number];
  resourceType: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "APPLIED" | "CONFLICT" | "FAILED";
  conflictResolution: (typeof SYNC_CONFLICT_RESOLUTIONS)[number] | null;
  error: string | null;
  createdAt: Date;
  appliedAt: Date | null;
}

const OfflineSyncItemSchema = new Schema<IOfflineSyncItem>(
  {
    syncId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    clientOpId: { type: String, required: true },
    operation: { type: String, enum: OFFLINE_OPS, required: true },
    resourceType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["PENDING", "APPLIED", "CONFLICT", "FAILED"],
      default: "PENDING",
    },
    conflictResolution: {
      type: String,
      enum: ["KEEP_SERVER", "KEEP_LOCAL", "REVIEW"],
      default: null,
    },
    error: { type: String, default: null },
    appliedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);
OfflineSyncItemSchema.index({ organizationId: 1, userId: 1, clientOpId: 1 }, { unique: true });

export const OfflineSyncItem: Model<IOfflineSyncItem> =
  mongoose.models.OfflineSyncItem ??
  mongoose.model<IOfflineSyncItem>("OfflineSyncItem", OfflineSyncItemSchema);

/* ─── Push delivery log (honest states) ─── */
export interface IPushDelivery extends Document {
  deliveryId: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId | null;
  notificationId: string | null;
  title: string;
  /** Preview must not include secrets / evidence / credentials */
  preview: string;
  category: string;
  state: (typeof PUSH_DELIVERY_STATES)[number];
  provider: string;
  attempts: number;
  lastError: string | null;
  testMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PushDeliverySchema = new Schema<IPushDelivery>(
  {
    deliveryId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, default: null },
    notificationId: { type: String, default: null },
    title: { type: String, required: true },
    preview: { type: String, default: "" },
    category: { type: String, default: "SYSTEM" },
    state: { type: String, enum: PUSH_DELIVERY_STATES, default: "CREATED" },
    provider: { type: String, default: "NONE" },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    testMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PushDelivery: Model<IPushDelivery> =
  mongoose.models.PushDelivery ?? mongoose.model<IPushDelivery>("PushDelivery", PushDeliverySchema);

export interface IPushSubscription extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string;
  createdAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, default: "" },
      auth: { type: String, default: "" },
    },
    userAgent: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);
PushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

export const PushSubscription: Model<IPushSubscription> =
  mongoose.models.PushSubscription ??
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
