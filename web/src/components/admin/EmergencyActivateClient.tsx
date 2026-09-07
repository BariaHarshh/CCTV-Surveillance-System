"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { EMERGENCY_TYPES, CAMPUS_EMERGENCY_MODES } from "@/lib/emergency/constants";

export function EmergencyActivateClient({ user }: { user: SafeUser }) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [type, setType] = useState<string>("SECURITY");
  const [mode, setMode] = useState<string>("EMERGENCY");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function activate() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/emergencies", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          mode,
          reason,
          description,
          location: { label: location, building: location },
          confirm: true,
          severity: "CRITICAL",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Activation failed");
      router.push(`/admin/emergencies/${data.emergency.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmitting(false);
    }
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Emergency Activation</h1>
      <p className="mt-1 text-muted">Activate organization emergency mode with confirmation required.</p>

      {step === "form" ? (
        <div className="mt-8 max-w-xl space-y-4 rounded-2xl border border-border bg-surface/50 p-6">
          <div>
            <label className="text-xs text-muted">Emergency Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm">
              {EMERGENCY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm">
              {CAMPUS_EMERGENCY_MODES.filter((m) => m !== "NORMAL").map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Reason *</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm" placeholder="Why is emergency mode required?" />
          </div>
          <div>
            <label className="text-xs text-muted">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm" placeholder="Building / area" />
          </div>
          <div>
            <label className="text-xs text-muted">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm" />
          </div>
          <button
            type="button"
            disabled={reason.trim().length < 3}
            onClick={() => setStep("confirm")}
            className="w-full rounded-xl bg-red-500/20 py-3 text-sm font-semibold text-red-300 disabled:opacity-40"
          >
            Continue to Confirmation
          </button>
        </div>
      ) : (
        <div className="mt-8 max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h2 className="text-lg font-bold text-red-300">Confirm Emergency Activation</h2>
          <p className="mt-2 text-sm text-muted">Are you sure you want to activate Emergency Mode?</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted">Type</dt><dd>{type.replace(/_/g, " ")}</dd></div>
            <div><dt className="text-muted">Mode</dt><dd>{mode}</dd></div>
            <div><dt className="text-muted">Reason</dt><dd>{reason}</dd></div>
            <div><dt className="text-muted">Location</dt><dd>{location || "—"}</dd></div>
          </dl>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setStep("form")} className="flex-1 rounded-xl border border-border py-3 text-sm">Cancel</button>
            <button type="button" disabled={submitting} onClick={activate} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? "Activating…" : "Activate Emergency"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
