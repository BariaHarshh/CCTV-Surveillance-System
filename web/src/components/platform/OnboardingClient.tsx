"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

const STEP_LINKS: Record<string, string> = {
  organizationProfile: "/admin/settings/organization",
  adminProfile: "/admin/profile",
  campus: "/admin/campus",
  building: "/admin/campus/buildings",
  camera: "/admin/cameras",
  aiProvider: "/admin/settings/ai",
  alertRule: "/admin/settings/notifications",
  responseTeam: "/admin/response-teams",
  playbook: "/admin/playbooks",
  staff: "/admin/staff",
};

type Status = {
  steps: Record<string, boolean>;
  stepOrder: string[];
  completed: number;
  total: number;
  percent: number;
};

export function OnboardingClient({ user }: { user: SafeUser }) {
  const [status, setStatus] = useState<Status | null>(null);

  async function load() {
    const res = await fetch("/api/onboarding", { credentials: "include" });
    const j = await res.json();
    setStatus(j.onboarding);
  }

  useEffect(() => {
    load();
  }, []);

  async function mark(step: string) {
    await fetch("/api/onboarding", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, done: true }),
    });
    await load();
  }

  if (!status) {
    return (
      <AdminShell user={user}>
        <Loader2 className="mt-12 h-8 w-8 animate-spin text-accent" />
      </AdminShell>
    );
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Onboarding</h1>
      <p className="mt-1 text-muted">
        {status.completed}/{status.total} complete · {status.percent}%
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-accent transition-all" style={{ width: `${status.percent}%` }} />
      </div>

      <ul className="mt-8 space-y-3">
        {status.stepOrder.map((step) => {
          const done = Boolean(status.steps[step]);
          return (
            <li
              key={step}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Circle className="h-5 w-5 text-muted" />
                )}
                <div>
                  <div className="font-medium capitalize">{step.replace(/([A-Z])/g, " $1")}</div>
                  {STEP_LINKS[step] && (
                    <Link href={STEP_LINKS[step]} className="text-xs text-accent">
                      Open
                    </Link>
                  )}
                </div>
              </div>
              {!done && (
                <button
                  type="button"
                  onClick={() => mark(step)}
                  className="rounded-lg border border-border px-3 py-1 text-xs hover:border-accent/40"
                >
                  Mark done
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </AdminShell>
  );
}
