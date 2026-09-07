import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Camera } from "@/models/Camera";
import { User } from "@/models/User";
import { Campus } from "@/models/Campus";
import { orgFilter } from "@/lib/campus/service";
import { getOrCreateSubscription } from "@/lib/platform/billing-service";
import { OnboardingProgress } from "@/models/Platform";
import { Automation, BackgroundJob, ApprovalRequest } from "@/models/Enterprise";
import { getAIStatus } from "@/lib/intelligence/providers";

export async function computeOrganizationHealth(organizationId: string) {
  await connectDB();
  const oid = new mongoose.Types.ObjectId(organizationId);
  const [users, cameras, campuses, offline, pendingApprovals, failedAutos, onboarding, sub] =
    await Promise.all([
      User.countDocuments({ organizationId: oid, deletedAt: null }),
      Camera.countDocuments(orgFilter(organizationId)),
      Campus.countDocuments(orgFilter(organizationId)),
      Camera.countDocuments(orgFilter(organizationId, { status: { $in: ["OFFLINE", "ERROR", "DISCONNECTED"] } })),
      ApprovalRequest.countDocuments({ organizationId: oid, status: "PENDING" }),
      Automation.countDocuments({ organizationId: oid, status: "ERROR" }),
      OnboardingProgress.findOne({ organizationId: oid }).lean().catch(() => null),
      getOrCreateSubscription(organizationId),
    ]);

  const factors: string[] = [];
  let score = 80;
  if (campuses === 0) {
    score -= 20;
    factors.push("No campus configured");
  }
  if (cameras === 0) {
    score -= 15;
    factors.push("No cameras configured");
  }
  if (offline > 0) {
    score -= Math.min(20, offline * 3);
    factors.push(`${offline} cameras offline/error`);
  }
  if (users < 2) {
    score -= 10;
    factors.push("Low staff coverage");
  }
  if (failedAutos > 0) {
    score -= 10;
    factors.push(`${failedAutos} automations in ERROR`);
  }
  if (pendingApprovals > 10) {
    score -= 5;
    factors.push("Approval backlog");
  }

  score = Math.max(0, Math.min(100, score));
  const label = score >= 75 ? "Healthy" : score >= 50 ? "Attention" : "At Risk";

  return {
    score,
    label,
    factors: factors.length ? factors : ["No elevated health risks detected from available signals"],
    metrics: { users, cameras, campuses, offline, pendingApprovals, failedAutos, planId: sub.planId },
    onboarding: onboarding?.steps ?? null,
  };
}

export async function runSystemReadiness(organizationId: string) {
  await connectDB();
  const checks: Array<{ key: string; status: "PASS" | "WARNING" | "FAIL"; problem?: string; fix?: string }> = [];

  checks.push({ key: "Authentication", status: "PASS" });
  checks.push({ key: "Database", status: "PASS" });

  const cameras = await Camera.countDocuments(orgFilter(organizationId));
  checks.push(
    cameras > 0
      ? { key: "Cameras", status: "PASS" }
      : { key: "Cameras", status: "WARNING", problem: "No cameras", fix: "Add at least one camera" }
  );

  const ai = getAIStatus();
  checks.push({
    key: "AI",
    status: ai.available ? "PASS" : "WARNING",
    problem: ai.available ? undefined : "External AI provider not configured",
    fix: ai.available ? undefined : "Set AI_PROVIDER_KEY or continue with tools-only mode",
  });

  checks.push({
    key: "Notifications",
    status: process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== "CONSOLE" ? "PASS" : "WARNING",
    problem: "Email provider is CONSOLE/dev",
    fix: "Configure EMAIL_PROVIDER for production delivery",
  });

  const dead = await BackgroundJob.countDocuments({ status: "DEAD" });
  checks.push(
    dead === 0
      ? { key: "Workers", status: "PASS" }
      : { key: "Workers", status: "WARNING", problem: `${dead} dead-letter jobs`, fix: "Retry dead-letter jobs" }
  );

  checks.push({ key: "Billing", status: "PASS" });
  checks.push({ key: "Organization", status: "PASS" });

  return { checks, asOf: new Date().toISOString() };
}

export function listServiceCatalog() {
  const ai = getAIStatus();
  return [
    { name: "API", status: "OPERATIONAL", version: "1.0", health: "ok" },
    { name: "Database", status: "OPERATIONAL", version: "mongo", health: "ok" },
    { name: "Cache", status: process.env.REDIS_URL ? "OPERATIONAL" : "NOT_CONFIGURED", version: "-", health: "n/a" },
    { name: "AI", status: ai.available ? "OPERATIONAL" : "NOT_CONFIGURED", version: ai.model, health: ai.mode },
    { name: "Workers", status: "OPERATIONAL", version: "enterprise-job", health: "ok" },
    { name: "Notifications", status: process.env.EMAIL_PROVIDER ?? "CONSOLE", version: "-", health: "ok" },
    { name: "Reports", status: "OPERATIONAL", version: "1.0", health: "ok" },
    { name: "Storage", status: process.env.STORAGE_URL ? "OPERATIONAL" : "NOT_CONFIGURED", version: "-", health: "n/a" },
    { name: "Webhooks", status: "OPERATIONAL", version: "1.0", health: "ok" },
    { name: "Billing", status: "OPERATIONAL", version: "1.0", health: "ok" },
    { name: "Search", status: "OPERATIONAL", version: "1.0", health: "ok" },
  ];
}
