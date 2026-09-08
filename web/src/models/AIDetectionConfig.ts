import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { AI_MODULE_TYPES } from "@/lib/ai/constants";

export interface IModuleConfig {
  enabled: boolean;
  confidenceThreshold: number | null;
  cooldownSeconds: number | null;
  scheduleId: string | null;
  zoneIds: string[];
  lastDetectionAt: Date | null;
}

export interface IAIDetectionConfig extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  cameraId: Types.ObjectId;
  modules: Record<string, IModuleConfig>;
  occupancyCapacity: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const ModuleConfigSchema = new Schema<IModuleConfig>(
  {
    enabled: { type: Boolean, default: false },
    confidenceThreshold: { type: Number, default: null },
    cooldownSeconds: { type: Number, default: null },
    scheduleId: { type: String, default: null },
    zoneIds: { type: [String], default: [] },
    lastDetectionAt: { type: Date, default: null },
  },
  { _id: false }
);

const defaultModules = (): Record<string, IModuleConfig> => {
  const m: Record<string, IModuleConfig> = {};
  for (const t of AI_MODULE_TYPES) {
    m[t] = {
      enabled: t === "PERSON_DETECTION" || t === "CAMERA_TAMPER",
      confidenceThreshold: null,
      cooldownSeconds: null,
      scheduleId: null,
      zoneIds: [],
      lastDetectionAt: null,
    };
  }
  return m;
};

const AIDetectionConfigSchema = new Schema<IAIDetectionConfig>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, ref: "Camera", required: true, unique: true },
    modules: { type: Schema.Types.Mixed, default: defaultModules },
    occupancyCapacity: { type: Number, default: null },
    status: { type: String, default: "INACTIVE" },
  },
  { timestamps: true }
);

export const AIDetectionConfig: Model<IAIDetectionConfig> =
  mongoose.models.AIDetectionConfig ??
  mongoose.model<IAIDetectionConfig>("AIDetectionConfig", AIDetectionConfigSchema);

export { defaultModules };
