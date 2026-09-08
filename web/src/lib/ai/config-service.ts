import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { OrganizationAISettings } from "@/models/OrganizationAISettings";
import { AIDetectionConfig, defaultModules, type IAIDetectionConfig } from "@/models/AIDetectionConfig";
import { AIModelRegistry } from "@/models/AIModelRegistry";
import { Camera } from "@/models/Camera";
import { Event } from "@/models/Event";
import { orgFilter } from "@/lib/campus/service";
import {
  AI_MODULE_TYPES,
  AI_MODULE_LABELS,
  AI_MODULE_STATUSES,
  type AIModuleType,
  type AIModuleStatus,
  DEFAULT_ORG_AI_SETTINGS,
  MODULE_TO_EVENT,
} from "@/lib/ai/constants";

export async function getOrCreateOrgAISettings(organizationId: string) {
  await connectDB();
  let settings = await OrganizationAISettings.findOne({ organizationId: new mongoose.Types.ObjectId(organizationId) });
  if (!settings) {
    settings = await OrganizationAISettings.create({ organizationId: new mongoose.Types.ObjectId(organizationId) });
  }
  return settings;
}

export async function updateOrgAISettings(organizationId: string, patch: Record<string, unknown>) {
  await connectDB();
  const settings = await getOrCreateOrgAISettings(organizationId);
  if (patch.defaultConfidenceThreshold != null) settings.defaultConfidenceThreshold = Number(patch.defaultConfidenceThreshold);
  if (patch.eventCooldownSeconds != null) settings.eventCooldownSeconds = Number(patch.eventCooldownSeconds);
  if (patch.occupancyThresholds) settings.occupancyThresholds = { ...settings.occupancyThresholds, ...(patch.occupancyThresholds as object) };
  if (patch.abandonedObjectThresholdSeconds != null) settings.abandonedObjectThresholdSeconds = Number(patch.abandonedObjectThresholdSeconds);
  if (patch.afterHoursSeverity) settings.afterHoursSeverity = String(patch.afterHoursSeverity);
  if (patch.notificationRules) settings.notificationRules = { ...settings.notificationRules, ...(patch.notificationRules as object) };
  if (patch.dataRetention) settings.dataRetention = { ...settings.dataRetention, ...(patch.dataRetention as object) };
  await settings.save();
  return settings.toObject();
}

export async function getOrCreateCameraAIConfig(organizationId: string, cameraId: string) {
  await connectDB();
  let config = await AIDetectionConfig.findOne(
    orgFilter(organizationId, { cameraId: new mongoose.Types.ObjectId(cameraId) })
  );
  if (!config) {
    config = await AIDetectionConfig.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      cameraId: new mongoose.Types.ObjectId(cameraId),
      modules: defaultModules(),
    });
  }
  return config;
}

export async function updateCameraAIConfig(
  organizationId: string,
  cameraId: string,
  patch: { modules?: Record<string, unknown>; occupancyCapacity?: number | null }
) {
  await connectDB();
  const config = await getOrCreateCameraAIConfig(organizationId, cameraId);
  if (patch.modules) {
    for (const [key, val] of Object.entries(patch.modules)) {
      if (config.modules[key]) {
        config.modules[key] = { ...config.modules[key], ...(val as object) };
        config.markModified(`modules.${key}`);
      }
    }
  }
  if (patch.occupancyCapacity !== undefined) config.occupancyCapacity = patch.occupancyCapacity;
  const anyEnabled = AI_MODULE_TYPES.some((m) => config.modules[m]?.enabled);
  config.status = anyEnabled ? "ACTIVE" : "INACTIVE";
  await config.save();
  return config;
}

async function getModuleStatus(
  moduleType: AIModuleType,
  orgId: string,
  enabledCount: number
): Promise<{ status: AIModuleStatus; lastDetection: string | null; cameras: number }> {
  const models = await AIModelRegistry.find({ capabilities: moduleType }).limit(1);
  const hasProvider = models.some((m) => m.status === "ACTIVE");

  let status: AIModuleStatus = "INACTIVE";
  if (enabledCount > 0 && hasProvider) status = "ACTIVE";
  else if (enabledCount > 0 && !hasProvider) status = "CONFIGURATION_REQUIRED";

  const eventType = MODULE_TO_EVENT[moduleType];
  let lastDetection: string | null = null;
  if (eventType) {
    const last = await Event.findOne(orgFilter(orgId, { eventType }))
      .sort({ detectedAt: -1 })
      .select("detectedAt");
    lastDetection = last?.detectedAt?.toISOString() ?? null;
  }

  return { status, lastDetection, cameras: enabledCount };
}

export async function getAIModulesOverview(organizationId: string) {
  await connectDB();
  const orgSettings = await getOrCreateOrgAISettings(organizationId);
  const configs = await AIDetectionConfig.find(orgFilter(organizationId));
  const cameras = await Camera.countDocuments(orgFilter(organizationId));

  const modules = await Promise.all(
    AI_MODULE_TYPES.map(async (type) => {
      const enabledCount = configs.filter((c) => c.modules[type]?.enabled).length;
      const meta = await getModuleStatus(type, organizationId, enabledCount);
      return {
        type,
        label: AI_MODULE_LABELS[type],
        status: meta.status,
        enabled: enabledCount > 0,
        cameras: meta.cameras,
        sensitivity: "Default",
        confidenceThreshold: orgSettings.defaultConfidenceThreshold,
        lastDetection: meta.lastDetection,
      };
    })
  );

  return {
    modules,
    organizationSettings: orgSettings.toObject(),
    totalCameras: cameras,
    configuredCameras: configs.length,
  };
}

export function toCameraAIConfigPublic(config: IAIDetectionConfig, orgSettings: { defaultConfidenceThreshold: number; eventCooldownSeconds: number }) {
  return {
    id: config._id.toString(),
    cameraId: config.cameraId.toString(),
    modules: config.modules,
    occupancyCapacity: config.occupancyCapacity,
    status: config.status,
    defaults: {
      confidenceThreshold: orgSettings.defaultConfidenceThreshold,
      eventCooldownSeconds: orgSettings.eventCooldownSeconds,
    },
  };
}

export async function seedDefaultModels() {
  await connectDB();
  const defaults = [
    { modelId: "MDL-PERSON-001", name: "Person Detector", type: "PERSON_DETECTION", provider: "internal", capabilities: ["PERSON_DETECTION"], status: "ACTIVE" as const },
    { modelId: "MDL-OCC-001", name: "Occupancy Estimator", type: "OCCUPANCY_DETECTION", provider: "internal", capabilities: ["OCCUPANCY_DETECTION"], status: "ACTIVE" as const },
    { modelId: "MDL-ZONE-001", name: "Zone Rule Engine", type: "RESTRICTED_ZONE", provider: "internal", capabilities: ["RESTRICTED_ZONE"], status: "ACTIVE" as const },
    { modelId: "MDL-FIRE-001", name: "Fire Detector", type: "FIRE_DETECTION", provider: "external", capabilities: ["FIRE_DETECTION"], status: "CONFIGURATION_REQUIRED" as const },
    { modelId: "MDL-SMOKE-001", name: "Smoke Detector", type: "SMOKE_DETECTION", provider: "external", capabilities: ["SMOKE_DETECTION"], status: "CONFIGURATION_REQUIRED" as const },
  ];
  for (const d of defaults) {
    await AIModelRegistry.findOneAndUpdate({ modelId: d.modelId }, d, { upsert: true });
  }
}

export { DEFAULT_ORG_AI_SETTINGS, AI_MODULE_STATUSES };
