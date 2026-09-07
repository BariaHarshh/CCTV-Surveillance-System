"use client";

import { createContext, useContext } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";

interface AdminContextValue {
  user: SafeUser;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ user, children }: { user: SafeUser; children: React.ReactNode }) {
  return <AdminContext.Provider value={{ user }}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
