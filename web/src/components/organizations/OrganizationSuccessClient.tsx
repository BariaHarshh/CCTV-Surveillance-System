"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function OrganizationSuccessClient({ user }: { user: SafeUser }) {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const orgId = params.get("orgId") ?? "";
  const name = params.get("name") ?? "Organization";

  return (
    <SuperAdminShell user={user}>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" />
        <h1 className="mt-6 text-3xl font-bold">Organization Created Successfully</h1>
        <div className="mt-8 rounded-2xl border border-border bg-surface/60 p-6 text-left">
          <p className="text-sm text-muted">Organization</p>
          <p className="mt-1 font-medium">{decodeURIComponent(name)}</p>
          <p className="mt-4 text-sm text-muted">Organization ID</p>
          <p className="mt-1 font-mono text-accent">{decodeURIComponent(orgId)}</p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/super-admin/organizations/${id}`}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background">View Organization</Link>
          <Link href={`/super-admin/organizations/${id}/admins/new`}
            className="rounded-full border border-border px-6 py-2.5 text-sm">Create Administrator</Link>
          <Link href="/super-admin/organizations"
            className="rounded-full border border-border px-6 py-2.5 text-sm">Back to Organizations</Link>
        </div>
      </motion.div>
    </SuperAdminShell>
  );
}
