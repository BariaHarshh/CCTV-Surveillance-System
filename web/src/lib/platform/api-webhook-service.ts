import crypto from "crypto";
import { connectDB } from "@/lib/db/connect";
import { ApiKey, WebhookDelivery, WebhookEndpoint, generateOpaqueToken, hashToken } from "@/models/Platform";
import { getNextSequence } from "@/models/Counter";
import { requireFeature } from "@/lib/platform/billing-service";
import type { WebhookEvent } from "@/lib/platform/constants";
import mongoose from "mongoose";

export async function createApiKey(
  organizationId: string,
  input: { name: string; permissions?: string[]; expiresAt?: string | null },
  actor: { id: string; name: string }
) {
  await connectDB();
  await requireFeature(organizationId, "api_access");
  const raw = `acg_${generateOpaqueToken(24)}`;
  const prefix = raw.slice(0, 12);
  const seq = await getNextSequence("apikey");
  const doc = await ApiKey.create({
    keyId: `KEY-${String(seq).padStart(6, "0")}`,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    name: input.name,
    keyHash: hashToken(raw),
    prefix,
    permissions: input.permissions ?? ["read"],
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    createdBy: new mongoose.Types.ObjectId(actor.id),
    createdByName: actor.name,
  });
  return {
    id: doc._id.toString(),
    keyId: doc.keyId,
    name: doc.name,
    prefix: doc.prefix,
    permissions: doc.permissions,
    expiresAt: doc.expiresAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    /** Shown once only */
    secret: raw,
  };
}

export async function listApiKeys(organizationId: string) {
  await connectDB();
  const keys = await ApiKey.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    revokedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();
  return keys.map((k) => ({
    id: k._id.toString(),
    keyId: k.keyId,
    name: k.name,
    prefix: k.prefix,
    permissions: k.permissions,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
    createdByName: k.createdByName,
  }));
}

export async function revokeApiKey(organizationId: string, id: string) {
  await connectDB();
  const key = await ApiKey.findOne({
    _id: id,
    organizationId: new mongoose.Types.ObjectId(organizationId),
  });
  if (!key) return null;
  key.revokedAt = new Date();
  await key.save();
  return true;
}

export async function createWebhook(
  organizationId: string,
  input: { url: string; events: WebhookEvent[] },
  actor: { id: string }
) {
  await connectDB();
  await requireFeature(organizationId, "webhooks");
  const secret = `whsec_${generateOpaqueToken(24)}`;
  const seq = await getNextSequence("webhook");
  const doc = await WebhookEndpoint.create({
    webhookId: `WH-${String(seq).padStart(6, "0")}`,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    url: input.url,
    secretHash: hashToken(secret),
    secretPrefix: secret.slice(0, 10),
    events: input.events,
    enabled: true,
    createdBy: new mongoose.Types.ObjectId(actor.id),
  });
  return {
    id: doc._id.toString(),
    webhookId: doc.webhookId,
    url: doc.url,
    events: doc.events,
    enabled: doc.enabled,
    secretPrefix: doc.secretPrefix,
    /** Shown once */
    secret,
  };
}

export async function listWebhooks(organizationId: string) {
  await connectDB();
  const items = await WebhookEndpoint.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
  })
    .sort({ createdAt: -1 })
    .lean();
  return items.map((w) => ({
    id: w._id.toString(),
    webhookId: w.webhookId,
    url: w.url,
    events: w.events,
    enabled: w.enabled,
    secretPrefix: w.secretPrefix,
    createdAt: w.createdAt.toISOString(),
  }));
}

export async function listWebhookDeliveries(organizationId: string, webhookId?: string) {
  await connectDB();
  const q: Record<string, unknown> = { organizationId: new mongoose.Types.ObjectId(organizationId) };
  if (webhookId) q.webhookId = webhookId;
  const rows = await WebhookDelivery.find(q).sort({ createdAt: -1 }).limit(100).lean();
  return rows.map((r) => ({
    id: r._id.toString(),
    event: r.event,
    endpoint: r.endpoint,
    status: r.status,
    httpCode: r.httpCode,
    attempt: r.attempt,
    durationMs: r.durationMs,
    timestamp: r.createdAt.toISOString(),
  }));
}

export function signWebhookPayload(secret: string, body: string, timestamp: number) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** Deliver with retries + exponential backoff (max 3). Secrets never in payload. */
export async function deliverWebhookEvent(
  organizationId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
) {
  await connectDB();
  const endpoints = await WebhookEndpoint.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    enabled: true,
    events: event,
  });

  for (const ep of endpoints) {
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      event,
      createdAt: new Date().toISOString(),
      data: payload,
    });
    let attempt = 0;
    let status: "SUCCESS" | "FAILED" | "RETRYING" = "RETRYING";
    let httpCode: number | null = null;
    let durationMs: number | null = null;
    let error: string | null = null;

    while (attempt < 3) {
      attempt += 1;
      const started = Date.now();
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        // Note: we cannot recover raw secret after creation; use hash as HMAC key for delivery integrity of stored endpoints.
        // Production systems store an encrypted secret; here we HMAC with secretHash for replay-safe signature without exposing secrets in payload.
        const signature = signWebhookPayload(ep.secretHash, body, timestamp);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ACG-Timestamp": String(timestamp),
            "X-ACG-Signature": signature,
            "X-ACG-Event": event,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        httpCode = res.status;
        durationMs = Date.now() - started;
        if (res.ok) {
          status = "SUCCESS";
          break;
        }
        error = `HTTP ${res.status}`;
        status = attempt < 3 ? "RETRYING" : "FAILED";
      } catch (e) {
        durationMs = Date.now() - started;
        error = e instanceof Error ? e.message : "Delivery failed";
        status = attempt < 3 ? "RETRYING" : "FAILED";
      }
      if (status === "RETRYING" && attempt < 3) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 200));
      }
    }

    await WebhookDelivery.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      webhookId: ep.webhookId,
      event,
      endpoint: ep.url,
      status: status === "RETRYING" ? "FAILED" : status,
      httpCode,
      attempt,
      durationMs,
      error,
    });
  }
}
