/** Simple in-memory analytics cache — Redis-ready abstraction. Keys must include orgId. */
type CacheEntry = { value: unknown; expiresAt: number };

const store = new Map<string, CacheEntry>();

export const analyticsCache = {
  buildKey(organizationId: string, namespace: string, parts: Record<string, unknown> = {}) {
    const normalized = Object.keys(parts)
      .sort()
      .map((k) => `${k}=${JSON.stringify(parts[k] ?? null)}`)
      .join("&");
    return `analytics:${organizationId}:${namespace}:${normalized}`;
  },

  get<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.value as T;
  },

  set(key: string, value: unknown, ttlSeconds = 60) {
    // Guard: refuse keys without org segment
    if (!key.startsWith("analytics:") || key.split(":").length < 3) {
      throw new Error("Invalid analytics cache key — organizationId required");
    }
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  invalidateOrganization(organizationId: string) {
    for (const key of store.keys()) {
      if (key.includes(`:${organizationId}:`)) store.delete(key);
    }
  },

  clear() {
    store.clear();
  },
};
