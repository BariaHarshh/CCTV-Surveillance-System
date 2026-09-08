import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { AI_MODULE_STATUSES } from "@/lib/ai/constants";

export interface IAIModelRegistry extends Document {
  _id: Types.ObjectId;
  modelId: string;
  name: string;
  type: string;
  provider: string;
  version: string;
  capabilities: string[];
  status: (typeof AI_MODULE_STATUSES)[number];
  configuration: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AIModelRegistrySchema = new Schema<IAIModelRegistry>(
  {
    modelId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    provider: { type: String, required: true },
    version: { type: String, default: "1.0" },
    capabilities: { type: [String], default: [] },
    status: { type: String, enum: AI_MODULE_STATUSES, default: "INACTIVE" },
    configuration: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const AIModelRegistry: Model<IAIModelRegistry> =
  mongoose.models.AIModelRegistry ??
  mongoose.model<IAIModelRegistry>("AIModelRegistry", AIModelRegistrySchema);
