"use client";

import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import type { SafeUser } from "@/lib/auth/sanitize-user";

interface PlaceholderPageProps {
  user: SafeUser;
  title: string;
  description: string;
  actionLabel?: string;
}

export function PlaceholderPage({
  user,
  title,
  description,
  actionLabel,
}: PlaceholderPageProps) {
  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-xl text-muted">{description}</p>
      <div className="mt-8">
        <EmptyState
          title="Coming in the Next Development Step"
          description={description}
          actionLabel={actionLabel}
          icon="building"
        />
      </div>
    </SuperAdminShell>
  );
}
