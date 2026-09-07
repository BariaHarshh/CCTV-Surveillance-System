"use client";

import Link from "next/link";
import {
  Building2,
  Shield,
  Key,
  Webhook,
  Bell,
  Users,
  CreditCard,
  Database,
  ChevronRight,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

const sections = [
  { href: "/admin/settings/organization", label: "Organization", description: "Profile, branding, locale", icon: Building2 },
  { href: "/admin/settings/security", label: "Security", description: "Password & session policy, MFA", icon: Shield },
  { href: "/admin/settings/api", label: "API keys", description: "Programmatic access", icon: Key },
  { href: "/admin/settings/integrations/webhooks", label: "Webhooks", description: "Outbound event deliveries", icon: Webhook },
  { href: "/admin/settings/notifications", label: "Notification rules", description: "Alert routing rules", icon: Bell },
  { href: "/admin/settings/permissions", label: "Permissions", description: "Roles and access", icon: Users },
  { href: "/admin/billing", label: "Billing", description: "Plan, usage, invoices", icon: CreditCard },
  { href: "/admin/storage", label: "Storage & retention", description: "Data lifecycle policy", icon: Database },
];

export function SettingsHubClient({ user }: { user: SafeUser }) {
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-muted">Organization configuration and platform controls</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-start gap-4 rounded-2xl border border-border bg-surface/50 p-5 transition hover:border-accent/40 hover:bg-surface/80"
          >
            <div className="rounded-xl border border-border bg-glass p-2.5 text-accent">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{s.label}</h2>
                <ChevronRight className="h-4 w-4 text-muted opacity-0 transition group-hover:opacity-100" />
              </div>
              <p className="mt-1 text-sm text-muted">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
