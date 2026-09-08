import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { PLAYBOOK_CATEGORIES } from "@/lib/emergency/constants";

export interface IPlaybookStep {
  order: number;
  title: string;
  description: string;
}

export interface IPlaybook extends Document {
  _id: Types.ObjectId;
  playbookId: string;
  organizationId: Types.ObjectId;
  name: string;
  category: (typeof PLAYBOOK_CATEGORIES)[number];
  description: string;
  steps: IPlaybookStep[];
  version: number;
  enabled: boolean;
  createdBy: Types.ObjectId | null;
  createdByName: string;
  updatedBy: Types.ObjectId | null;
  updatedByName: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const StepSchema = new Schema<IPlaybookStep>(
  {
    order: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const PlaybookSchema = new Schema<IPlaybook>(
  {
    playbookId: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: PLAYBOOK_CATEGORIES, default: "OTHER" },
    description: { type: String, default: "" },
    steps: { type: [StepSchema], default: [] },
    version: { type: Number, default: 1 },
    enabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdByName: { type: String, default: "" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByName: { type: String, default: "" },
    source: { type: String, default: "MANUAL" },
  },
  { timestamps: true }
);

PlaybookSchema.index({ organizationId: 1, category: 1 });

export const Playbook: Model<IPlaybook> =
  mongoose.models.Playbook ?? mongoose.model<IPlaybook>("Playbook", PlaybookSchema);
