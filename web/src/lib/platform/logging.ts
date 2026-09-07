import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";

type RequestContext = {
  requestId: string;
  userId?: string;
  organizationId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function createRequestId() {
  return crypto.randomUUID();
}

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestId() {
  return storage.getStore()?.requestId ?? createRequestId();
}

export function getRequestContext() {
  return storage.getStore();
}

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

const SENSITIVE = /password|token|secret|authorization|recovery|apikey|api_key|cookie/i;

function sanitize(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = SENSITIVE.test(k) ? "[REDACTED]" : v;
  }
  return out;
}

export function logStructured(
  level: LogLevel,
  service: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  const ctx = storage.getStore();
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    requestId: ctx?.requestId,
    userId: ctx?.userId,
    organizationId: ctx?.organizationId,
    message,
    metadata: sanitize(metadata),
  };
  const line = JSON.stringify(entry);
  if (level === "ERROR" || level === "FATAL") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.info(line);
}
