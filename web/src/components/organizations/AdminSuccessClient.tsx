"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Eye, EyeOff } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

interface SuccessData {
  name: string;
  userId: string;
  orgName: string;
  orgId: string;
  password: string;
  adminId: string;
}

export function AdminSuccessClient({ user, organizationId }: { user: SafeUser; organizationId: string }) {
  const params = useSearchParams();
  const key = params.get("key");
  const [data, setData] = useState<SuccessData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    const raw = sessionStorage.getItem(key);
    if (raw) {
      setData(JSON.parse(raw) as SuccessData);
      sessionStorage.removeItem(key);
    }
  }, [key]);

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!data) {
    return (
      <SuperAdminShell user={user}>
        <div className="mx-auto max-w-lg text-center">
          <p className="text-muted">Credentials are only shown once immediately after creation.</p>
          <Link href={`/super-admin/organizations/${organizationId}`} className="mt-4 inline-block text-accent">
            Back to Organization
          </Link>
        </div>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell user={user}>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" />
        <h1 className="mt-6 text-3xl font-bold">Administrator Created Successfully</h1>
        <div className="mt-8 space-y-4 rounded-2xl border border-border bg-surface/60 p-6 text-left text-sm">
          <div>
            <p className="text-muted">Admin Name</p>
            <p className="font-medium">{data.name}</p>
          </div>
          <div>
            <p className="text-muted">Admin ID</p>
            <p className="font-mono text-accent">{data.userId}</p>
          </div>
          <div>
            <p className="text-muted">Organization</p>
            <p className="font-medium">{data.orgName}</p>
            <p className="font-mono text-xs text-muted">{data.orgId}</p>
          </div>
          <div>
            <p className="text-muted">Temporary Password</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono">{showPassword ? data.password : "••••••••••••"}</span>
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-amber-200/80">
          The administrator must change this temporary password on first login.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => copy(data.userId, "id")}
            className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm">
            <Copy className="h-3 w-3" /> {copied === "id" ? "Copied!" : "Copy Admin ID"}
          </button>
          <button type="button" onClick={() => copy(data.password, "pw")}
            className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm">
            <Copy className="h-3 w-3" /> {copied === "pw" ? "Copied!" : "Copy Temporary Password"}
          </button>
          <Link href={`/super-admin/organizations/${organizationId}`}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-background">Back to Organization</Link>
        </div>
      </motion.div>
    </SuperAdminShell>
  );
}
