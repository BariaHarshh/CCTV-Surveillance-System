"use client";

import Link from "next/link";
import { Brain, Key, Webhook, ChevronRight } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

const integrations = [
  {
    href: "/admin/settings/api",
    label: "API Keys",
    description: "Create and revoke programmatic access tokens",
    icon: Key,
  },
  {
    href: "/admin/settings/integrations/webhooks",
    label: "Webhooks",
    description: "Deliver alerts and incidents to external systems",
    icon: Webhook,
  },
  {
    href: "/admin/integrations/ai",
    label: "AI Providers",
    description: "Configure detection models and AI health",
    icon: Brain,
  },
  {
    href: "/admin/settings/ai",
    label: "AI Settings",
    description: "Detection thresholds and module configuration",
    icon: Brain,
  },
];

export function IntegrationsClient({ user }: { user: SafeUser }) {
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Integrations</h1>
      <p className="mt-1 text-sm text-muted">Connect AI Campus Guardian with external services</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {integrations.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-start gap-4 rounded-2xl border border-border bg-surface/50 p-5 transition hover:border-accent/40"
          >
            <div className="rounded-xl border border-border bg-glass p-2.5 text-accent">
              <item.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{item.label}</h2>
                <ChevronRight className="h-4 w-4 text-muted opacity-0 transition group-hover:opacity-100" />
              </div>
              <p className="mt-1 text-sm text-muted">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
