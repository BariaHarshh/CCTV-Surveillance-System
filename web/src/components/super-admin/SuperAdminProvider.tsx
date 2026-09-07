"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";

interface SuperAdminContextValue {
  user: SafeUser;
}

const SuperAdminContext = createContext<SuperAdminContextValue | null>(null);

export function SuperAdminProvider({
  user,
  children,
}: {
  user: SafeUser;
  children: ReactNode;
}) {
  return (
    <SuperAdminContext.Provider value={{ user }}>{children}</SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  const ctx = useContext(SuperAdminContext);
  if (!ctx) throw new Error("useSuperAdmin must be used within SuperAdminProvider");
  return ctx;
}
