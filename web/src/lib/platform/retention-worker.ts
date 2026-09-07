import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { RetentionPolicy, Evidence } from "@/models/Platform";
import { Event } from "@/models/Event";
import { Alert } from "@/models/Alert";
import { Organization } from "@/models/Organization";
import { logStructured } from "@/lib/platform/logging";

export async function getOrCreateRetentionPolicy(organizationId: string) {
  await connectDB();
  let policy = await RetentionPolicy.findOne({ organizationId: new mongoose.Types.ObjectId(organizationId) });
  if (!policy) {
    policy = await RetentionPolicy.create({ organizationId: new mongoose.Types.ObjectId(organizationId) });
  }
  return policy;
}

function cutoff(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Idempotent retention worker — never deletes legal-hold evidence. */
export async function runRetentionForOrganization(organizationId: string) {
  await connectDB();
  const policy = await getOrCreateRetentionPolicy(organizationId);
  const oid = new mongoose.Types.ObjectId(organizationId);

  const eventResult = await Event.deleteMany({
    organizationId: oid,
    detectedAt: { $lt: cutoff(policy.eventsDays) },
    source: { $ne: "TEST" },
  });

  const alertResult = await Alert.deleteMany({
    organizationId: oid,
    createdAt: { $lt: cutoff(policy.alertsDays) },
    source: { $ne: "TEST" },
  });

  const evidenceResult = await Evidence.deleteMany({
    organizationId: oid,
    legalHold: { $ne: true },
    retentionUntil: { $ne: null, $lt: new Date() },
  });

  logStructured("INFO", "retention-worker", "Retention pass complete", {
    organizationId,
    eventsDeleted: eventResult.deletedCount,
    alertsDeleted: alertResult.deletedCount,
    evidenceDeleted: evidenceResult.deletedCount,
  });

  return {
    organizationId,
    eventsDeleted: eventResult.deletedCount ?? 0,
    alertsDeleted: alertResult.deletedCount ?? 0,
    evidenceDeleted: evidenceResult.deletedCount ?? 0,
  };
}

export async function runRetentionWorker() {
  await connectDB();
  const orgs = await Organization.find({ deletedAt: null, status: "ACTIVE" }).select("_id").lean();
  const results = [];
  for (const org of orgs) {
    results.push(await runRetentionForOrganization(org._id.toString()));
  }
  return results;
}

export async function updateRetentionPolicy(
  organizationId: string,
  patch: Partial<{
    eventsDays: number;
    alertsDays: number;
    incidentsDays: number;
    emergenciesDays: number;
    cameraMetadataDays: number;
    aiResultsDays: number;
    auditDays: number;
    reportsDays: number;
  }>
) {
  await connectDB();
  const policy = await RetentionPolicy.findOneAndUpdate(
    { organizationId: new mongoose.Types.ObjectId(organizationId) },
    { $set: patch },
    { upsert: true, new: true }
  );
  return policy;
}
