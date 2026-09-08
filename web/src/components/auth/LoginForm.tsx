"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, FormEvent } from "react";
import { Eye, EyeOff, Loader2, AlertCircle, Lock, ShieldOff } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { resolvePostLoginRedirect } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type LoginState = "default" | "loading" | "error" | "locked" | "suspended";

export function LoginForm() {
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userIdOrEmail, setUserIdOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<LoginState>("default");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ userIdOrEmail?: string; password?: string }>({});

  const reason = searchParams.get("reason");

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      router.replace(
        resolvePostLoginRedirect(
          user.role,
          user.mustChangePassword,
          searchParams.get("redirect")
        )
      );
    }
  }, [authLoading, isAuthenticated, user, router, searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setErrorMessage("");
    setState("default");

    const errors: { userIdOrEmail?: string; password?: string } = {};
    if (!userIdOrEmail.trim()) {
      errors.userIdOrEmail = "Please enter your User ID or email.";
    }
    if (!password) {
      errors.password = "Please enter your password.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setState("loading");

    const result = await login(userIdOrEmail.trim(), password, rememberMe);

    if (result.success) {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      const meData = meRes.ok ? await meRes.json() : null;
      router.push(
        resolvePostLoginRedirect(
          meData?.user?.role ?? "STAFF",
          meData?.user?.mustChangePassword ?? false,
          searchParams.get("redirect")
        )
      );
      router.refresh();
      return;
    }

    if (result.code === "ACCOUNT_LOCKED") {
      setState("locked");
      setErrorMessage(
        result.message ??
          "Your account has been temporarily locked due to multiple failed login attempts."
      );
      return;
    }

    if (result.code === "ACCOUNT_SUSPENDED") {
      setState("suspended");
      setErrorMessage(
        result.message ??
          "Your access to AI Campus Guardian has been temporarily suspended. Contact your organization administrator."
      );
      return;
    }

    if (result.code === "ACCOUNT_INACTIVE") {
      setState("error");
      setErrorMessage(
        result.message ?? "Your account is inactive. Contact your organization administrator."
      );
      return;
    }

    if (result.code === "DATABASE_UNAVAILABLE") {
      setState("error");
      setErrorMessage(
        "Unable to reach the database. Ensure MongoDB is running and MONGODB_URI is set in .env.local."
      );
      return;
    }

    if (result.code === "NETWORK_ERROR") {
      setState("error");
      setErrorMessage(result.error ?? "Service unavailable. Please try again later.");
      return;
    }

    setState("error");
    setErrorMessage(result.message ?? result.error ?? "Invalid User ID or password.");
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 xl:px-20"
    >
      <div className="mx-auto w-full max-w-md">
        {/* Mobile brand */}
        <div className="mb-8 lg:hidden">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent">AI CAMPUS GUARDIAN</p>
          <p className="mt-2 text-lg font-bold gradient-text">SEE. UNDERSTAND. PROTECT.</p>
        </div>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome Back</h2>
        <p className="mt-2 text-muted">Secure access to AI Campus Guardian</p>

        {authLoading && (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Checking session...
          </p>
        )}

        {reason === "session_expired" && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-200/90">
              Your session has expired. Please sign in again.
            </p>
          </div>
        )}

        {state === "locked" && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4"
          >
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-300">Account Temporarily Locked</p>
              <p className="mt-1 text-sm text-red-200/80">{errorMessage}</p>
            </div>
          </div>
        )}

        {state === "suspended" && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4"
          >
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-300">Account Suspended</p>
              <p className="mt-1 text-sm text-red-200/80">{errorMessage}</p>
            </div>
          </div>
        )}

        {state === "error" && errorMessage && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-200/90">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          <div>
            <label htmlFor="userIdOrEmail" className="block text-sm font-medium text-foreground/90">
              User ID / Email
            </label>
            <input
              id="userIdOrEmail"
              name="userIdOrEmail"
              type="text"
              autoComplete="username"
              value={userIdOrEmail}
              onChange={(e) => setUserIdOrEmail(e.target.value)}
              disabled={state === "loading"}
              aria-invalid={Boolean(fieldErrors.userIdOrEmail)}
              aria-describedby={fieldErrors.userIdOrEmail ? "userIdOrEmail-error" : undefined}
              className={cn(
                "mt-2 w-full rounded-xl border bg-glass px-4 py-3 text-sm text-foreground outline-none transition-all",
                "placeholder:text-muted/50 focus:border-accent/50 focus:ring-2 focus:ring-accent/20",
                fieldErrors.userIdOrEmail ? "border-red-500/50" : "border-border"
              )}
              placeholder="Enter your User ID or email"
            />
            {fieldErrors.userIdOrEmail && (
              <p id="userIdOrEmail-error" className="mt-1.5 text-xs text-red-400" role="alert">
                {fieldErrors.userIdOrEmail}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground/90">
              Password
            </label>
            <div className="relative mt-2">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={state === "loading"}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
                className={cn(
                  "w-full rounded-xl border bg-glass px-4 py-3 pr-12 text-sm text-foreground outline-none transition-all",
                  "placeholder:text-muted/50 focus:border-accent/50 focus:ring-2 focus:ring-accent/20",
                  fieldErrors.password ? "border-red-500/50" : "border-border"
                )}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="mt-1.5 text-xs text-red-400" role="alert">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={state === "loading"}
                className="h-4 w-4 rounded border-white/20 bg-glass text-accent focus:ring-accent/30"
              />
              <span className="text-sm text-muted">Remember Me</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-accent transition-colors hover:text-accent-dim"
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={state === "loading"}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-sm font-semibold text-background transition-all hover:bg-accent-dim hover:shadow-[0_0_40px_rgba(56,189,248,0.35)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {state === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <Link
          href="/"
          className="mt-8 inline-flex items-center text-sm text-muted transition-colors hover:text-foreground"
        >
          ← Back to Platform
        </Link>
      </div>
    </motion.div>
  );
}
