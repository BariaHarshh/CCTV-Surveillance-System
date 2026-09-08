import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { EnterpriseEvent, newEnterpriseId } from "@/models/Enterprise";
import { getRequestId } from "@/lib/platform/logging";
import { enqueueJob } from "./job-queue";

type Handler = (event: {
  eventId: string;
  organizationId: string | null;
  type: string;
  payloadReference: Record<string, unknown>;
  correlationId: string | null;
}) => Promise<void> | void;

const subscribers = new Map<string, Handler[]>();

export function subscribeEnterpriseEvent(type: string | "*", handler: Handler) {
  const list = subscribers.get(type) ?? [];
  list.push(handler);
  subscribers.set(type, list);
  return () => {
    subscribers.set(
      type,
      (subscribers.get(type) ?? []).filter((h) => h !== handler)
    );
  };
}

/** Publish minimal secure event — never put secrets in payloadReference. */
export async function publishEnterpriseEvent(opts: {
  organizationId?: string | null;
  type: string;
  source?: string;
  resourceType?: string | null;
  resourceId?: string | null;
  payloadReference?: Record<string, unknown>;
  correlationId?: string | null;
}) {
  await connectDB();
  const eventId = newEnterpriseId("evt");
  const correlationId = opts.correlationId ?? crypto.randomUUID();
  const doc = await EnterpriseEvent.create({
    eventId,
    organizationId: opts.organizationId ? new mongoose.Types.ObjectId(opts.organizationId) : null,
    type: opts.type,
    source: opts.source ?? "system",
    resourceType: opts.resourceType ?? null,
    resourceId: opts.resourceId ?? null,
    payloadReference: opts.payloadReference ?? {},
    requestId: getRequestId(),
    correlationId,
    version: 1,
  });

  const payload = {
    eventId: doc.eventId,
    organizationId: opts.organizationId ?? null,
    type: doc.type,
    payloadReference: doc.payloadReference as Record<string, unknown>,
    correlationId,
  };

  const handlers = [...(subscribers.get(opts.type) ?? []), ...(subscribers.get("*") ?? [])];
  for (const h of handlers) {
    try {
      await h(payload);
    } catch (err) {
      console.error("[event-bus]", opts.type, err instanceof Error ? err.message : err);
    }
  }

  // Fan-out to workflow worker via job queue
  if (opts.organizationId) {
    await enqueueJob({
      type: "WORKFLOW_EVENT",
      organizationId: opts.organizationId,
      payload: { eventType: opts.type, eventId, correlationId, resourceId: opts.resourceId },
      correlationId,
      idempotencyKey: `wf:${opts.type}:${opts.resourceId ?? eventId}`,
    });
  }

  return doc;
}
