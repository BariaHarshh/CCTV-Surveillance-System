"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { AI_MODULE_LABELS, type AIModuleType } from "@/lib/ai/constants";

const MODULE_KEYS = Object.keys(AI_MODULE_LABELS) as AIModuleType[];

export function CameraAIClient({ user, cameraId }: { user: SafeUser; cameraId: string }) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`/api/admin/cameras/${cameraId}/ai`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setConfig(d.config));
  };

  useEffect(() => { load(); }, [cameraId]);

  async function toggleModule(moduleKey: string, enabled: boolean) {
    setSaving(true);
    await fetch(`/api/admin/cameras/${cameraId}/ai`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules: { [moduleKey]: { enabled } } }),
    });
    setSaving(false);
    load();
  }

  const modules = (config?.modules ?? {}) as Record<string, { enabled: boolean; confidenceThreshold: number | null; cooldownSeconds: number | null }>;
  const defaults = config?.defaults as { confidenceThreshold: number; eventCooldownSeconds: number } | undefined;

  return (
    <AdminShell user={user}>
      <Link href="/admin/cameras" className="text-xs text-accent hover:underline">← Cameras</Link>
      <h1 className="mt-2 text-2xl font-bold">Camera AI Configuration</h1>
      <p className="mt-1 text-sm text-muted">Enable detection modules and override organization defaults.</p>

      {defaults && (
        <p className="mt-4 text-xs text-muted">
          Org defaults — Confidence: {Math.round(defaults.confidenceThreshold * 100)}%, Cooldown: {defaults.eventCooldownSeconds}s
        </p>
      )}

      <div className="mt-6 space-y-3">
        {MODULE_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="font-medium">{AI_MODULE_LABELS[key]}</p>
              <p className="text-xs text-muted">{modules[key]?.enabled ? "Enabled" : "Disabled"}</p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => toggleModule(key, !modules[key]?.enabled)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${modules[key]?.enabled ? "bg-accent/15 text-accent" : "bg-white/5 text-muted"}`}
            >
              {modules[key]?.enabled ? "ON" : "OFF"}
            </button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
