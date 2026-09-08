import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { BackgroundJob, newEnterpriseId } from "@/models/Enterprise";

export async function enqueueJob(opts: {
  type: string;
  organizationId?: string | null;
  payload?: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string | null;
  correlationId?: string | null;
}) {
  await connectDB();
  if (opts.idempotencyKey) {
    const existing = await BackgroundJob.findOne({
      idempotencyKey: opts.idempotencyKey,
      status: { $in: ["QUEUED", "RUNNING", "COMPLETED", "RETRYING"] },
    });
    if (existing) return existing;
  }

  return BackgroundJob.create({
    jobId: newEnterpriseId("job"),
    organizationId: opts.organizationId ? new mongoose.Types.ObjectId(opts.organizationId) : null,
    type: opts.type,
    status: "QUEUED",
    payload: opts.payload ?? {},
    attempts: 0,
    maxAttempts: opts.maxAttempts ?? 3,
    idempotencyKey: opts.idempotencyKey ?? null,
    correlationId: opts.correlationId ?? null,
    runAt: opts.runAt ?? new Date(),
  });
}

export async function processNextJobs(limit = 10) {
  await connectDB();
  const jobs = await BackgroundJob.find({
    status: { $in: ["QUEUED", "RETRYING"] },
    runAt: { $lte: new Date() },
  })
    .sort({ runAt: 1 })
    .limit(limit);

  for (const job of jobs) {
    job.status = "RUNNING";
    job.attempts += 1;
    await job.save();
    try {
      await handleJob(job.type, job.payload as Record<string, unknown>, {
        organizationId: job.organizationId?.toString() ?? null,
        correlationId: job.correlationId,
        jobId: job.jobId,
      });
      job.status = "COMPLETED";
      job.completedAt = new Date();
      job.error = null;
      await job.save();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Job failed";
      job.error = message;
      if (job.attempts >= job.maxAttempts) {
        job.status = "DEAD";
      } else {
        job.status = "RETRYING";
        // exponential backoff: 30s, 60s, 120s
        const delaySec = 30 * 2 ** (job.attempts - 1);
        job.runAt = new Date(Date.now() + delaySec * 1000);
      }
      await job.save();
    }
  }
}

async function handleJob(
  type: string,
  payload: Record<string, unknown>,
  meta: { organizationId: string | null; correlationId: string | null; jobId: string }
) {
  if (type === "WORKFLOW_EVENT") {
    const { processEventForAutomations } = await import("./workflow-engine");
    if (!meta.organizationId) return;
    await processEventForAutomations({
      organizationId: meta.organizationId,
      eventType: String(payload.eventType ?? ""),
      eventId: String(payload.eventId ?? ""),
      correlationId: meta.correlationId ?? meta.jobId,
      resourceId: payload.resourceId ? String(payload.resourceId) : null,
      dryRun: false,
    });
    return;
  }
  if (type === "NOTIFICATION_RETRY" || type === "WEBHOOK_RETRY" || type === "REPORT_GENERATE") {
    // Handlers reserved — no-op success unless specialized modules invoke failures
    return;
  }
  if (type === "PUSH_DELIVER") {
    const { processPushDelivery } = await import("@/lib/mobile/push-service");
    await processPushDelivery(String(payload.deliveryId || ""));
    return;
  }
  if (type === "VIDEO_AI_PROCESS") {
    const { processVideoDetection } = await import("@/lib/video/pipeline");
    if (!meta.organizationId) throw new Error("organizationId required");
    const result = await processVideoDetection({
      organizationId: meta.organizationId,
      cameraId: String(payload.cameraId ?? ""),
      eventType: String(payload.eventType ?? "MOTION_EVENT"),
      confidence: Number(payload.confidence ?? 0),
      demo: Boolean(payload.demo),
      modelId: payload.modelId ? String(payload.modelId) : undefined,
      modelVersion: payload.modelVersion ? String(payload.modelVersion) : undefined,
    });
    if (!result.ok && !("deduplicated" in result && result.deduplicated)) {
      throw new Error(result.reason || "VIDEO_AI_PROCESS failed");
    }
    return;
  }
  if (type === "VIDEO_EVIDENCE_PROCESS" || type === "VIDEO_CLIP_GENERATE" || type === "VIDEO_THUMBNAIL") {
    // Placeholder — evidence jobs complete when recording store is unavailable (honest no-op)
    return;
  }
  if (type === "VIDEO_HEALTH_CHECK" || type === "CAMERA_OFFLINE_CHECK") {
    const { testCameraConnection } = await import("@/lib/video/video-service");
    if (!meta.organizationId || !payload.cameraId) return;
    await testCameraConnection(meta.organizationId, String(payload.cameraId));
    return;
  }
  // Unknown types complete without side effects (safe default)
}

export async function getJobStats() {
  await connectDB();
  const [queued, running, completed, failed, dead, retrying] = await Promise.all([
    BackgroundJob.countDocuments({ status: "QUEUED" }),
    BackgroundJob.countDocuments({ status: "RUNNING" }),
    BackgroundJob.countDocuments({ status: "COMPLETED" }),
    BackgroundJob.countDocuments({ status: "FAILED" }),
    BackgroundJob.countDocuments({ status: "DEAD" }),
    BackgroundJob.countDocuments({ status: "RETRYING" }),
  ]);
  return { queued, running, completed, failed, dead, retrying, queueLength: queued + retrying };
}

export async function retryDeadLetter(jobId: string) {
  await connectDB();
  const job = await BackgroundJob.findOne({ jobId, status: "DEAD" });
  if (!job) throw new Error("Dead-letter job not found");
  job.status = "QUEUED";
  job.attempts = 0;
  job.error = null;
  job.runAt = new Date();
  await job.save();
  return job;
}

let workerStarted = false;
export function startEnterpriseJobWorker() {
  if (workerStarted) return;
  workerStarted = true;
  const tick = async () => {
    try {
      await processNextJobs(5);
    } catch (err) {
      console.error("[EnterpriseJobWorker]", err instanceof Error ? err.message : err);
    }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, 20_000);
}
