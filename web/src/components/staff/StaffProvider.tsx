"use client";

import { createContext, useContext } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";

interface StaffContextValue {
  user: SafeUser;
}

const StaffContext = createContext<StaffContextValue | null>(null);

export function StaffProvider({ user, children }: { user: SafeUser; children: React.ReactNode }) {
  return <StaffContext.Provider value={{ user }}>{children}</StaffContext.Provider>;
}

export function useStaffPortal() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaffPortal must be used within StaffProvider");
  return ctx;
}
