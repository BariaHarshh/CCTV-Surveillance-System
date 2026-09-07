import crypto from "crypto";
import { connectDB } from "@/lib/db/connect";
import {
  DEFAULT_PLAN_LIMITS,
  DEFAULT_TRIAL_DAYS,
  type FeatureKey,
  type PlanId,
  type SubscriptionStatus,
} from "@/lib/platform/constants";
import {
  Invoice,
  Plan,
  Subscription,
  UsageRecord,
} from "@/models/Platform";
import { Organization } from "@/models/Organization";
import { User } from "@/models/User";
import { Camera } from "@/models/Camera";
import { Event } from "@/models/Event";
import { getNextSequence } from "@/models/Counter";
import mongoose from "mongoose";

const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIAL: ["ACTIVE", "EXPIRED", "CANCELLED"],
  ACTIVE: ["PAST_DUE", "PAUSED", "CANCELLED"],
  PAST_DUE: ["ACTIVE", "CANCELLED", "EXPIRED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  CANCELLED: ["EXPIRED"],
  EXPIRED: ["TRIAL", "ACTIVE"],
};

export class PlanLimitError extends Error {
  code = "PLAN_LIMIT_REACHED" as const;
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export class FeatureGateError extends Error {
  code = "FEATURE_NOT_AVAILABLE" as const;
  constructor(message: string) {
    super(message);
    this.name = "FeatureGateError";
  }
}

async function ensureDefaultPlans() {
  for (const [planId, limits] of Object.entries(DEFAULT_PLAN_LIMITS)) {
    const prices: Record<string, number> = {
      FREE: 0,
      STARTER: 99,
      PROFESSIONAL: 399,
      ENTERPRISE: 0,
    };
    await Plan.findOneAndUpdate(
      { planId: planId as PlanId },
      {
        $setOnInsert: {
          planId: planId as PlanId,
          name: planId.charAt(0) + planId.slice(1).toLowerCase(),
          description: `${planId} plan`,
          price: prices[planId] ?? 0,
          currency: "USD",
          billingInterval: "month",
          limits,
          features: limits.features,
          enabled: true,
        },
      },
      { upsert: true }
    );
  }
}

export async function getOrCreateSubscription(organizationId: string) {
  await connectDB();
  await ensureDefaultPlans();
  let sub = await Subscription.findOne({ organizationId: new mongoose.Types.ObjectId(organizationId) });
  if (sub) {
    if (sub.status === "TRIAL" && sub.trialEndsAt && sub.trialEndsAt.getTime() < Date.now()) {
      await transitionSubscription(organizationId, "EXPIRED");
      sub = await Subscription.findOne({ organizationId: new mongoose.Types.ObjectId(organizationId) });
    }
    return sub!;
  }

  const now = new Date();
  const trialEnds = new Date(now.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const seq = await getNextSequence("subscription");
  sub = await Subscription.create({
    subscriptionId: `SUB-${String(seq).padStart(6, "0")}`,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    planId: "FREE",
    status: "TRIAL",
    startedAt: now,
    trialEndsAt: trialEnds,
    currentPeriodStart: now,
    currentPeriodEnd: trialEnds,
    provider: "INTERNAL",
  });
  return sub;
}

export async function transitionSubscription(organizationId: string, next: SubscriptionStatus) {
  await connectDB();
  const sub = await Subscription.findOne({ organizationId: new mongoose.Types.ObjectId(organizationId) });
  if (!sub) throw new Error("Subscription not found");
  const allowed = VALID_TRANSITIONS[sub.status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid subscription transition ${sub.status} → ${next}`);
  }
  sub.status = next;
  if (next === "CANCELLED") sub.cancelledAt = new Date();
  await sub.save();
  return sub;
}

export async function changePlan(organizationId: string, planId: PlanId) {
  await connectDB();
  await ensureDefaultPlans();
  const plan = await Plan.findOne({ planId, enabled: true });
  if (!plan) throw new Error("Plan not found");
  const sub = await getOrCreateSubscription(organizationId);
  if (["EXPIRED", "CANCELLED"].includes(sub.status)) {
    sub.status = "ACTIVE";
  } else if (sub.status === "TRIAL") {
    sub.status = "ACTIVE";
  }
  sub.planId = planId;
  const now = new Date();
  sub.currentPeriodStart = now;
  sub.currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await sub.save();
  return sub;
}

export async function getPlanLimits(organizationId: string) {
  const sub = await getOrCreateSubscription(organizationId);
  const defaults = DEFAULT_PLAN_LIMITS[sub.planId] ?? DEFAULT_PLAN_LIMITS.FREE;
  const plan = await Plan.findOne({ planId: sub.planId });
  return {
    subscription: {
      subscriptionId: sub.subscriptionId,
      planId: sub.planId,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    },
    limits: { ...defaults, ...(plan?.limits ?? {}) },
    features: (plan?.features as FeatureKey[]) ?? defaults.features,
  };
}

export async function hasFeature(organizationId: string, feature: FeatureKey): Promise<boolean> {
  const { features, subscription } = await getPlanLimits(organizationId);
  if (subscription.status === "EXPIRED" || subscription.status === "CANCELLED") {
    return feature === "basic_analytics" || feature === "ai_detection";
  }
  return features.includes(feature);
}

export async function requireFeature(organizationId: string, feature: FeatureKey) {
  if (!(await hasFeature(organizationId, feature))) {
    throw new FeatureGateError(`Feature "${feature}" is not available on your current plan.`);
  }
}

export async function collectUsage(organizationId: string) {
  await connectDB();
  const oid = new mongoose.Types.ObjectId(organizationId);
  const period = new Date().toISOString().slice(0, 7);
  const monthStart = new Date(`${period}-01T00:00:00.000Z`);
  const [users, cameras, aiEvents, reports] = await Promise.all([
    User.countDocuments({ organizationId: oid, deletedAt: null }),
    Camera.countDocuments({ organizationId: oid }),
    Event.countDocuments({ organizationId: oid, detectedAt: { $gte: monthStart }, source: { $ne: "TEST" } }),
    (await import("@/models/AnalyticsReport")).AnalyticsReport.countDocuments({
      organizationId: oid,
      createdAt: { $gte: monthStart },
    }),
  ]);

  const usage = await UsageRecord.findOneAndUpdate(
    { organizationId: oid, period },
    {
      $set: {
        users,
        cameras,
        aiEvents,
        reports,
      },
    },
    { upsert: true, new: true }
  );

  return usage;
}

export async function assertWithinLimit(
  organizationId: string,
  metric: "maxUsers" | "maxCameras" | "maxAiEventsPerMonth" | "maxReportsPerMonth" | "maxApiCallsPerDay",
  current: number
) {
  const { limits, subscription } = await getPlanLimits(organizationId);
  if (subscription.status === "EXPIRED") {
    throw new PlanLimitError("Trial or subscription expired. Upgrade to continue.");
  }
  const max = Number(limits[metric] ?? 0);
  if (max > 0 && current >= max) {
    throw new PlanLimitError(`Plan limit reached for ${metric} (${current}/${max}).`);
  }
}

export async function getBillingOverview(organizationId: string) {
  const [{ subscription, limits, features }, usage, invoices, plan] = await Promise.all([
    getPlanLimits(organizationId),
    collectUsage(organizationId),
    Invoice.find({ organizationId: new mongoose.Types.ObjectId(organizationId) })
      .sort({ createdAt: -1 })
      .limit(24)
      .lean(),
    Plan.findOne({ planId: (await getOrCreateSubscription(organizationId)).planId }).lean(),
  ]);

  const org = await Organization.findById(organizationId).select("basicInformation.name").lean();

  return {
    organization: org?.basicInformation?.name ?? "Organization",
    subscription,
    plan: plan
      ? {
          planId: plan.planId,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          billingInterval: plan.billingInterval,
          description: plan.description,
        }
      : null,
    limits,
    features,
    usage: {
      users: { used: usage.users, max: limits.maxUsers },
      cameras: { used: usage.cameras, max: limits.maxCameras },
      aiEvents: { used: usage.aiEvents, max: limits.maxAiEventsPerMonth },
      reports: { used: usage.reports, max: limits.maxReportsPerMonth },
      storageMb: { used: usage.storageMb, max: limits.maxStorageMb },
      apiRequests: { used: usage.apiRequests, max: limits.maxApiCallsPerDay },
    },
    invoices: invoices.map((i) => ({
      id: i._id.toString(),
      invoiceNumber: i.invoiceNumber,
      amount: i.amount,
      currency: i.currency,
      status: i.status,
      periodStart: i.periodStart.toISOString(),
      periodEnd: i.periodEnd.toISOString(),
      paidAt: i.paidAt?.toISOString() ?? null,
    })),
  };
}

export async function listPlans() {
  await connectDB();
  await ensureDefaultPlans();
  return Plan.find({ enabled: true }).sort({ price: 1 }).lean();
}

/** Payment provider adapter interface — Stripe/Razorpay plug in here. */
export interface PaymentProvider {
  name: string;
  createCheckoutSession(input: {
    organizationId: string;
    planId: PlanId;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; sessionId: string }>;
  verifyWebhook(rawBody: string, signature: string): Promise<{ type: string; data: Record<string, unknown> }>;
}

export class InternalPaymentProvider implements PaymentProvider {
  name = "INTERNAL";
  async createCheckoutSession(input: {
    organizationId: string;
    planId: PlanId;
    successUrl: string;
    cancelUrl: string;
  }) {
    await changePlan(input.organizationId, input.planId);
    const seq = await getNextSequence("invoice");
    const sub = await getOrCreateSubscription(input.organizationId);
    const plan = await Plan.findOne({ planId: input.planId });
    await Invoice.create({
      invoiceNumber: `INV-${String(seq).padStart(6, "0")}`,
      organizationId: new mongoose.Types.ObjectId(input.organizationId),
      amount: plan?.price ?? 0,
      currency: plan?.currency ?? "USD",
      status: "PAID",
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      paidAt: new Date(),
    });
    return {
      url: input.successUrl,
      sessionId: `internal_${crypto.randomBytes(8).toString("hex")}`,
    };
  }
  async verifyWebhook(rawBody: string, signature: string) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET ?? "";
    if (!secret) {
      throw new Error("Invalid payment webhook signature");
    }
    if (!signature) {
      throw new Error("Invalid payment webhook signature");
    }
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("Invalid payment webhook signature");
    }
    return JSON.parse(rawBody) as { type: string; data: Record<string, unknown> };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? "INTERNAL";
  if (provider === "INTERNAL") return new InternalPaymentProvider();
  // Stripe/Razorpay adapters can be registered here without leaking into business logic.
  return new InternalPaymentProvider();
}
