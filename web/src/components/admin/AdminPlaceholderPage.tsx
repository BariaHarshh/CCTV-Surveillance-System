"use client";

import { AdminShell } from "./AdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function AdminPlaceholderPage({
  user,
  title,
  description,
}: {
  user: SafeUser;
  title: string;
  description: string;
}) {
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-xl text-muted">{description}</p>
      <div className="mt-8">
        <EmptyState title="Coming in the Next Development Step" description={description} icon="building" />
      </div>
    </AdminShell>
  );
}
