"use client";

import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

const links = [
  { href: "/help/changelog", label: "Changelog", description: "Product updates and releases" },
  { href: "/status", label: "System status", description: "Live platform health" },
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/security", label: "Security overview" },
  { href: "/cookies", label: "Cookie policy" },
];

export function HelpClient({ user }: { user: SafeUser }) {
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Help & resources</h1>
      <p className="mt-1 text-muted">Documentation, policies, and support</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-accent/40"
          >
            <div className="font-semibold">{l.label}</div>
            {"description" in l && l.description && (
              <p className="mt-1 text-sm text-muted">{l.description}</p>
            )}
          </Link>
        ))}
      </div>
      <section className="mt-8 rounded-2xl border border-border bg-surface/50 p-6">
        <h2 className="font-semibold">Contact support</h2>
        <p className="mt-2 text-sm text-muted">
          Email support@aicampusguardian.com with your organization ID and a short description of the
          issue.
        </p>
      </section>
    </AdminShell>
  );
}
