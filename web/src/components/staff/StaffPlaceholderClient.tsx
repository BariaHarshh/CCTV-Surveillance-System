"use client";

import { StaffShell } from "./StaffShell";
import { EmptyState } from "@/components/super-admin/EmptyState";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export function StaffPlaceholderClient({ user, title, description }: { user: SafeUser; title: string; description: string }) {
  return (
    <StaffShell user={user}>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-xl text-muted">{description}</p>
      <div className="mt-8"><EmptyState title="Coming in Step 7" description={description} icon="inbox" /></div>
    </StaffShell>
  );
}
