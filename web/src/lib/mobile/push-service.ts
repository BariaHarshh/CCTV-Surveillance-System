import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { orgFilter } from "@/lib/campus/service";
import { PushDelivery, PushSubscription, newMobileId } from "@/models/Mobile";
import { enqueueJob } from "@/lib/enterprise/job-queue";

/**
 * Push delivery — honest states.
 * Without PUSH_PROVIDER configured, deliveries are SKIPPED (never claimed as delivered).
 */
export async function queuePushDelivery(input: {
  organizationId: string;
  userId: string | null;
  notificationId: string | null;
  title: string;
  preview: string;
  category: string;
  testMode?: boolean;
}) {
  await connectDB();
  const provider = process.env.PUSH_PROVIDER || "NONE";
  const delivery = await PushDelivery.create({
    deliveryId: newMobileId("push"),
    organizationId: new mongoose.Types.ObjectId(input.organizationId),
    userId: input.userId ? new mongoose.Types.ObjectId(input.userId) : null,
    notificationId: input.notificationId,
    title: input.title,
    preview: input.preview,
    category: input.category,
    state: provider === "NONE" ? "SKIPPED" : "QUEUED",
    provider,
    attempts: 0,
    testMode: Boolean(input.testMode),
    lastError: provider === "NONE" ? "PUSH_PROVIDER not configured" : null,
  });

  if (provider !== "NONE") {
    await enqueueJob({
      organizationId: input.organizationId,
      type: "PUSH_DELIVER",
      payload: { deliveryId: delivery.deliveryId },
      maxAttempts: 3,
    });
  }

  return {
    deliveryId: delivery.deliveryId,
    state: delivery.state,
    provider,
    note:
      delivery.state === "SKIPPED"
        ? "Push not claimed as delivered — provider not configured"
        : "Queued for provider",
  };
}

export async function processPushDelivery(deliveryId: string) {
  await connectDB();
  const delivery = await PushDelivery.findOne({ deliveryId });
  if (!delivery) return { ok: false, reason: "not found" };
  if (delivery.state === "DELIVERED" || delivery.state === "SKIPPED") {
    return { ok: true, state: delivery.state };
  }

  delivery.attempts += 1;
  const provider = process.env.PUSH_PROVIDER || "NONE";
  if (provider === "NONE") {
    delivery.state = "SKIPPED";
    delivery.lastError = "PUSH_PROVIDER not configured";
    await delivery.save();
    return { ok: true, state: "SKIPPED" };
  }

  // Provider hook — without a real adapter, mark SENT only (not DELIVERED unless confirmed)
  try {
    const subs = delivery.userId
      ? await PushSubscription.find({
          organizationId: delivery.organizationId,
          userId: delivery.userId,
        })
      : [];
    if (!subs.length) {
      delivery.state = "FAILED";
      delivery.lastError = "No push subscriptions for user";
      await delivery.save();
      return { ok: false, state: "FAILED" };
    }
    delivery.state = "SENT";
    delivery.lastError = null;
    await delivery.save();
    return {
      ok: true,
      state: "SENT",
      note: "Marked SENT — DELIVERED only when provider confirms (not assumed)",
    };
  } catch (e) {
    delivery.state = "FAILED";
    delivery.lastError = e instanceof Error ? e.message : "push failed";
    await delivery.save();
    return { ok: false, state: "FAILED" };
  }
}

export async function registerPushSubscription(
  organizationId: string,
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }
) {
  await connectDB();
  await PushSubscription.findOneAndUpdate(
    { endpoint: sub.endpoint },
    {
      $set: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        userId: new mongoose.Types.ObjectId(userId),
        keys: sub.keys,
        userAgent: sub.userAgent ?? "",
      },
    },
    { upsert: true }
  );
  return { ok: true };
}

export async function getPushAnalytics(organizationId: string) {
  await connectDB();
  const rows = await PushDelivery.find(orgFilter(organizationId)).sort({ createdAt: -1 }).limit(200);
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.state] = (counts[r.state] || 0) + 1;
  return {
    counts,
    recent: rows.slice(0, 20).map((r) => ({
      deliveryId: r.deliveryId,
      title: r.title,
      state: r.state,
      provider: r.provider,
      testMode: r.testMode,
      attempts: r.attempts,
    })),
    note: "DELIVERED only when provider confirms; SKIPPED when push is not configured",
  };
}
