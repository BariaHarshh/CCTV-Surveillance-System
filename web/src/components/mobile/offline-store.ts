/** Client-only offline draft store — cleared on logout by clearing key. */
const KEY = "acg_mobile_drafts_v1";

export type OfflineDraft = {
  clientDraftId: string;
  title: string;
  description?: string;
  severity?: string;
  type?: string;
  building?: string;
  createdAt: string;
  status: "DRAFT" | "PENDING_SYNC";
};

export function saveOfflineDraft(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const drafts = listOfflineDrafts();
  drafts.push({
    clientDraftId: String(payload.clientDraftId || `draft_${Date.now()}`),
    title: String(payload.title || "Draft"),
    description: String(payload.description || ""),
    severity: String(payload.severity || "MEDIUM"),
    type: String(payload.type || "OTHER"),
    building: String(payload.building || ""),
    createdAt: new Date().toISOString(),
    status: "PENDING_SYNC",
  });
  localStorage.setItem(KEY, JSON.stringify(drafts));
}

export function listOfflineDrafts(): OfflineDraft[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearOfflineDrafts() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export async function flushDraftsToServer() {
  const drafts = listOfflineDrafts();
  for (const d of drafts) {
    await fetch("/api/mobile/sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enqueue",
        clientOpId: d.clientDraftId,
        operation: "CREATE",
        resourceType: "INCIDENT_DRAFT",
        payload: d,
      }),
    });
  }
  await fetch("/api/mobile/sync", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "process" }),
  });
  clearOfflineDrafts();
}
