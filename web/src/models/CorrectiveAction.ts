import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { ACTION_PRIORITIES, ACTION_STATUSES } from "@/lib/analytics/constants";

export interface ICorrectiveAction extends Document {
  _id: Types.ObjectId;
  actionId: string;
  organizationId: Types.ObjectId;
  sourceType: string;
  sourceId: Types.ObjectId | null;
  title: string;
  description: string;
  priority: (typeof ACTION_PRIORITIES)[number];
  assignedTo: Types.ObjectId | null;
  assignedToName: string;
  assignedTeam: Types.ObjectId | null;
  assignedTeamName: string;
  dueAt: Date | null;
  status: (typeof ACTION_STATUSES)[number];
  completedAt: Date | null;
  createdBy: Types.ObjectId | null;
  createdByName: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const CorrectiveActionSchema = new Schema<ICorrectiveAction>(
  {
    actionId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    sourceType: { type: String, default: "MANUAL" },
    sourceId: { type: Schema.Types.ObjectId, default: null },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    priority: { type: String, enum: ACTION_PRIORITIES, default: "MEDIUM" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedToName: { type: String, default: "" },
    assignedTeam: { type: Schema.Types.ObjectId, ref: "ResponseTeam", default: null },
    assignedTeamName: { type: String, default: "" },
    dueAt: { type: Date, default: null },
    status: { type: String, enum: ACTION_STATUSES, default: "OPEN", index: true },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdByName: { type: String, default: "" },
    source: { type: String, default: "MANUAL" },
  },
  { timestamps: true }
);

CorrectiveActionSchema.index({ organizationId: 1, status: 1, dueAt: 1 });

export const CorrectiveAction: Model<ICorrectiveAction> =
  mongoose.models.CorrectiveAction ?? mongoose.model<ICorrectiveAction>("CorrectiveAction", CorrectiveActionSchema);
