"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, Copy, Eye, EyeOff } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

export const STAFF_SUCCESS_STORAGE_KEY = "acg_staff_success_latest";

function decodeParam(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readPasswordFromStorage(key: string | null): string {
  if (typeof window === "undefined") return "";
  const keys = [key, STAFF_SUCCESS_STORAGE_KEY].filter(Boolean) as string[];
  for (const storageKey of keys) {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { password?: string };
      if (parsed.password) return parsed.password;
    } catch {
      continue;
    }
  }
  return "";
}

export function StaffSuccessClient({ user }: { user: SafeUser }) {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");

  const name = decodeParam(searchParams.get("name"));
  const userId = decodeParam(searchParams.get("userId"));
  const staffId = decodeParam(searchParams.get("staffId"));
  const orgName = decodeParam(searchParams.get("orgName"));
  const orgId = decodeParam(searchParams.get("orgId"));

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setPassword(readPasswordFromStorage(key));
  }, [key]);

  const hasIdentity = Boolean(name && userId && staffId);
  const credentialsExpired = hasIdentity && !password;

  const clearStoredCredentials = () => {
    if (key) sessionStorage.removeItem(key);
    sessionStorage.removeItem(STAFF_SUCCESS_STORAGE_KEY);
  };

  const copy = async (text: string, label: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!hasIdentity) {
    return (
      <AdminShell user={user}>
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-xl font-semibold">Success details unavailable</h1>
          <p className="mt-2 text-sm text-muted">
            Create a staff account from the wizard to view credentials here. Temporary passwords cannot be recovered from this page alone.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/admin/staff/new" className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background">
              Create Staff
            </Link>
            <Link href="/admin/staff" className="rounded-full border border-border px-6 py-2.5 text-sm">
              Back to Staff
            </Link>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell user={user}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center"
      >
        <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
        <h1 className="mt-4 text-2xl font-bold">Staff Account Created</h1>
        <p className="mt-2 text-muted">
          {name} has been added{orgName ? ` to ${orgName}` : ""}
        </p>

        {credentialsExpired && (
          <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
            The temporary password is not available on this view. Use reset password from the staff profile if needed.
          </p>
        )}

        <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface/60 p-4 text-left text-sm">
          <div>
            <span className="text-muted">Staff Name</span>
            <p className="font-medium">{name}</p>
          </div>
          <div>
            <span className="text-muted">Staff ID</span>
            <p className="font-mono font-medium text-accent">{userId}</p>
          </div>
          {orgName && (
            <div>
              <span className="text-muted">Organization</span>
              <p className="font-medium">{orgName}</p>
              {orgId && <p className="font-mono text-xs text-muted">{orgId}</p>}
            </div>
          )}
          {password ? (
            <div>
              <span className="text-muted">Temporary Password</span>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-mono font-medium">{showPassword ? password : "••••••••••••"}</p>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : null}
          {password && (
            <p className="text-xs text-amber-300">Share credentials securely. Staff must change password on first login.</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => copy(userId, "id")}
            className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm"
          >
            <Copy className="h-3 w-3" /> {copied === "id" ? "Copied!" : "Copy Staff ID"}
          </button>
          {password && (
            <button
              type="button"
              onClick={() => copy(password, "pw")}
              className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm"
            >
              <Copy className="h-3 w-3" /> {copied === "pw" ? "Copied!" : "Copy Password"}
            </button>
          )}
          <Link
            href={`/admin/staff/${staffId}`}
            onClick={clearStoredCredentials}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background"
          >
            View Staff
          </Link>
          <Link href="/admin/staff" onClick={clearStoredCredentials} className="rounded-full border border-border px-6 py-2.5 text-sm">
            Back to Staff
          </Link>
        </div>
      </motion.div>
    </AdminShell>
  );
}
