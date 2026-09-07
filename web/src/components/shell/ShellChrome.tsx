"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const ShellNestContext = createContext(false);

/** True when already inside a portal shell (layout-mounted). */
export function useIsInsideShell() {
  return useContext(ShellNestContext);
}

export function ShellNestProvider({ children }: { children: ReactNode }) {
  return <ShellNestContext.Provider value={true}>{children}</ShellNestContext.Provider>;
}

function shallowMergeIfChanged<T extends Record<string, unknown>>(prev: T, patch: Partial<T>): T {
  let changed = false;
  const next = { ...prev };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (patch[key] !== undefined && patch[key] !== prev[key]) {
      next[key] = patch[key] as T[keyof T];
      changed = true;
    }
  }
  return changed ? next : prev;
}

export type AdminChromeState = {
  organizationName?: string;
  organizationStatus?: string;
  notifications?: { id: string; description: string; time: string }[];
};

type AdminChromeContextValue = {
  chrome: AdminChromeState;
  setChrome: (patch: Partial<AdminChromeState>) => void;
};

const AdminChromeContext = createContext<AdminChromeContextValue | null>(null);

export function AdminChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<AdminChromeState>({});
  const setChrome = useCallback((patch: Partial<AdminChromeState>) => {
    setChromeState((prev) => shallowMergeIfChanged(prev, patch));
  }, []);
  const value = useMemo(() => ({ chrome, setChrome }), [chrome, setChrome]);
  return <AdminChromeContext.Provider value={value}>{children}</AdminChromeContext.Provider>;
}

export function useAdminChrome() {
  return useContext(AdminChromeContext);
}

/** Stable setter only — safe for effect deps without looping on chrome reads. */
export function useAdminChromeSetter() {
  const ctx = useAdminChrome();
  const ref = useRef(ctx?.setChrome);
  ref.current = ctx?.setChrome;
  return useCallback((patch: Partial<AdminChromeState>) => {
    ref.current?.(patch);
  }, []);
}

export type SuperAdminChromeState = {
  systemStatus?: "operational" | "degraded";
  notifications?: { id: string; description: string; time: string }[];
  onStatusClick?: () => void;
};

type SuperAdminChromeContextValue = {
  chrome: SuperAdminChromeState;
  setChrome: (patch: Partial<SuperAdminChromeState>) => void;
};

const SuperAdminChromeContext = createContext<SuperAdminChromeContextValue | null>(null);

export function SuperAdminChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<SuperAdminChromeState>({
    systemStatus: "operational",
  });
  const setChrome = useCallback((patch: Partial<SuperAdminChromeState>) => {
    setChromeState((prev) => shallowMergeIfChanged(prev, patch));
  }, []);
  const value = useMemo(() => ({ chrome, setChrome }), [chrome, setChrome]);
  return (
    <SuperAdminChromeContext.Provider value={value}>{children}</SuperAdminChromeContext.Provider>
  );
}

export function useSuperAdminChrome() {
  return useContext(SuperAdminChromeContext);
}

export function useSuperAdminChromeSetter() {
  const ctx = useSuperAdminChrome();
  const ref = useRef(ctx?.setChrome);
  ref.current = ctx?.setChrome;
  return useCallback((patch: Partial<SuperAdminChromeState>) => {
    ref.current?.(patch);
  }, []);
}
