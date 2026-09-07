import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { RESPONSE_TASK_STATUSES, TASK_PRIORITIES } from "@/lib/emergency/constants";

export interface ITaskChecklistItem {
  key: string;
  label: string;
  done: boolean;
  doneAt: Date | null;
  doneBy: Types.ObjectId | null;
}

export interface ITaskTimelineEntry {
  action: string;
  at: Date;
  userId: Types.ObjectId | null;
  userName: string;
  note: string;
}

export interface ITaskAttachment {
  type: "PHOTO" | "VIDEO" | "DOCUMENT" | "NOTE" | "EVIDENCE_REF";
  ref: string;
  name: string;
  verified: boolean;
  uploadedAt: Date;
  uploadedBy: Types.ObjectId | null;
}

export interface IResponseTask extends Document {
  _id: Types.ObjectId;
  taskId: string;
  organizationId: Types.ObjectId;
  incidentId: Types.ObjectId | null;
  emergencyId: Types.ObjectId | null;
  title: string;
  description: string;
  taskType: string;
  assignedTo: Types.ObjectId | null;
  assignedToName: string;
  assignedTeam: Types.ObjectId | null;
  assignedTeamName: string;
  priority: (typeof TASK_PRIORITIES)[number];
  status: (typeof RESPONSE_TASK_STATUSES)[number];
  dueAt: Date | null;
  completedAt: Date | null;
  completedBy: Types.ObjectId | null;
  locationLabel: string;
  checklist: ITaskChecklistItem[];
  timeline: ITaskTimelineEntry[];
  attachments: ITaskAttachment[];
  notes: string[];
  acknowledgedAt: Date | null;
  startedAt: Date | null;
  slaAckMinutes: number | null;
  slaCompleteMinutes: number | null;
  source: string;
  demo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResponseTaskSchema = new Schema<IResponseTask>(
  {
    taskId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", default: null },
    emergencyId: { type: Schema.Types.ObjectId, ref: "Emergency", default: null },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    taskType: { type: String, default: "GENERAL" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedToName: { type: String, default: "" },
    assignedTeam: { type: Schema.Types.ObjectId, ref: "ResponseTeam", default: null, index: true },
    assignedTeamName: { type: String, default: "" },
    priority: { type: String, enum: TASK_PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: RESPONSE_TASK_STATUSES, default: "PENDING", index: true },
    dueAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, default: null },
    locationLabel: { type: String, default: "" },
    checklist: {
      type: [
        {
          key: String,
          label: String,
          done: { type: Boolean, default: false },
          doneAt: { type: Date, default: null },
          doneBy: { type: Schema.Types.ObjectId, default: null },
        },
      ],
      default: [],
    },
    timeline: {
      type: [
        {
          action: String,
          at: { type: Date, default: Date.now },
          userId: { type: Schema.Types.ObjectId, default: null },
          userName: String,
          note: String,
        },
      ],
      default: [],
    },
    attachments: {
      type: [
        {
          type: { type: String },
          ref: String,
          name: String,
          verified: { type: Boolean, default: false },
          uploadedAt: { type: Date, default: Date.now },
          uploadedBy: { type: Schema.Types.ObjectId, default: null },
        },
      ],
      default: [],
    },
    notes: { type: [String], default: [] },
    acknowledgedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    slaAckMinutes: { type: Number, default: null },
    slaCompleteMinutes: { type: Number, default: null },
    source: { type: String, default: "MANUAL" },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ResponseTaskSchema.index({ organizationId: 1, emergencyId: 1, status: 1 });
ResponseTaskSchema.index({ organizationId: 1, incidentId: 1 });
ResponseTaskSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });

export const ResponseTask: Model<IResponseTask> =
  mongoose.models.ResponseTask ?? mongoose.model<IResponseTask>("ResponseTask", ResponseTaskSchema);
