"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { getPasswordStrength } from "@/lib/auth/password";
import { getDefaultRedirectForRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

export function FirstLoginPasswordForm() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to change password");
        return;
      }
      await refreshUser();
      router.replace(getDefaultRedirectForRole(user?.role ?? "ADMIN", false));
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface/80 p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
        <Lock className="h-6 w-6 text-accent" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">Create Your New Password</h1>
      <p className="mt-2 text-sm text-muted">
        For security, you must set a new password before accessing AI Campus Guardian.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Temporary Password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-glass px-4 py-3 text-sm outline-none focus:border-accent/40" required />
        </div>
        <div>
          <label className="block text-sm font-medium">New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-glass px-4 py-3 text-sm outline-none focus:border-accent/40" required />
          <PasswordStrengthIndicator password={newPassword} strength={getPasswordStrength(newPassword)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Confirm New Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            className={cn("mt-2 w-full rounded-xl border bg-glass px-4 py-3 text-sm outline-none focus:border-accent/40",
              confirmPassword && confirmPassword !== newPassword ? "border-red-500/50" : "border-border")} required />
        </div>
        <button type="submit" disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-background disabled:opacity-70">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : "Set New Password"}
        </button>
      </form>
    </motion.div>
  );
}
