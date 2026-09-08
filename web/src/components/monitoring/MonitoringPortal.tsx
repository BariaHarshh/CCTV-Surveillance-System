"use client";

import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { StaffShell } from "@/components/staff/StaffShell";

export function MonitoringPortal({
  portal,
  user,
  children,
}: {
  portal: "admin" | "staff";
  user: SafeUser;
  children: React.ReactNode;
}) {
  if (portal === "admin") return <AdminShell user={user}>{children}</AdminShell>;
  return <StaffShell user={user}>{children}</StaffShell>;
}
