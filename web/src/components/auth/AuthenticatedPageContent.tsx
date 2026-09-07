"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CheckCircle2, LogOut, Shield, User } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatRoleLabel, resolvePostLoginRedirect } from "@/lib/auth/roles";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function AuthenticatedContent() {
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    router.replace(resolvePostLoginRedirect(user.role, user.mustChangePassword, null));
  }, [user, router]);

  if (!user) return null;

  const roleLabel = formatRoleLabel(user.role);

  const details = [
    { label: "Name", value: user.name },
    { label: "User ID", value: user.userId },
    { label: "Role", value: roleLabel.toUpperCase() },
    { label: "Organization", value: user.organizationId ?? "Platform Level" },
    { label: "Account Status", value: user.status },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.1),transparent)]" />
      <div className="absolute inset-0 grid-pattern opacity-20" />

      <div className="relative mx-auto max-w-2xl px-6 py-20 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" strokeWidth={1.5} />
          </div>

          <p className="mt-8 text-xs font-semibold tracking-[0.2em] text-accent">
            AUTHENTICATION SUCCESSFUL
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome to AI Campus Guardian
          </h1>
          <p className="mt-4 text-muted">
            Your account has been securely authenticated.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="gradient-border mt-12 rounded-3xl bg-surface/80 p-8 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 border-b border-border pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <User className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-lg font-semibold">Welcome, {user.name}</p>
              <p className="text-sm text-accent">Role: {roleLabel.toUpperCase()}</p>
            </div>
          </div>

          <dl className="mt-6 space-y-4">
            {details.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted">{item.label}</dt>
                <dd className="text-sm font-medium text-right">{item.value}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/dashboard-preview"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-background transition-all hover:bg-accent-dim hover:shadow-[0_0_40px_rgba(56,189,248,0.35)]"
          >
            <Shield className="h-4 w-4" />
            Continue to Platform
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-glass px-8 py-3.5 text-sm font-medium text-muted transition-all hover:bg-glass-hover hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export function AuthenticatedPageContent() {
  return (
    <ProtectedRoute>
      <AuthenticatedContent />
    </ProtectedRoute>
  );
}
