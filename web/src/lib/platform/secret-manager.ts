/**
 * SecretManager — env-backed today; adapters for AWS SM / Azure KV / GCP / Vault later.
 * Never put secrets in source code.
 */
export interface SecretManager {
  get(name: string): Promise<string | null>;
}

class EnvSecretManager implements SecretManager {
  async get(name: string) {
    return process.env[name] ?? null;
  }
}

let manager: SecretManager = new EnvSecretManager();

export function setSecretManager(next: SecretManager) {
  manager = next;
}

export function getSecretManager() {
  return manager;
}

export async function requireSecret(name: string): Promise<string> {
  const value = await manager.get(name);
  if (!value) throw new Error(`Required secret missing: ${name}`);
  return value;
}

const REQUIRED_IN_PRODUCTION = [
  "MONGODB_URI",
  "SESSION_SECRET",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
] as const;

/** Validate environment on startup — fail closed in production. */
export function validateEnvironment(env = process.env): { ok: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];
  const isProd = env.NODE_ENV === "production";

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!env[key] || String(env[key]).includes("change-me") || String(env[key]).includes("dev-")) {
      if (isProd) missing.push(key);
      else warnings.push(`${key} uses a development placeholder`);
    }
  }

  if (isProd && !env.CAMERA_ENCRYPTION_KEY && !env.ENCRYPTION_KEY) {
    missing.push("CAMERA_ENCRYPTION_KEY or ENCRYPTION_KEY");
  }

  if (isProd && !env.PAYMENT_WEBHOOK_SECRET && !env.WEBHOOK_SECRET) {
    missing.push("PAYMENT_WEBHOOK_SECRET or WEBHOOK_SECRET");
  }

  if (isProd && !env.INTERNAL_EVENTS_API_KEY) {
    missing.push("INTERNAL_EVENTS_API_KEY");
  }

  if (isProd && (!env.NEXT_PUBLIC_APP_URL || String(env.NEXT_PUBLIC_APP_URL).startsWith("http://"))) {
    warnings.push("NEXT_PUBLIC_APP_URL should be an https:// production origin");
  }

  return { ok: missing.length === 0, missing, warnings };
}

export function assertEnvironmentOrThrow() {
  const result = validateEnvironment();
  for (const w of result.warnings) console.warn(`[env] ${w}`);
  if (!result.ok) {
    throw new Error(`Application startup failed:\n${result.missing.map((m) => `${m} is missing.`).join("\n")}`);
  }
  return result;
}
