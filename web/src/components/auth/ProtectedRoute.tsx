"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { getDefaultRedirectForRole } from "@/lib/auth/roles";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requirePasswordChange?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requirePasswordChange = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?reason=session_expired");
      return;
    }
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      router.replace("/forbidden");
      return;
    }
    if (requirePasswordChange && user && !user.mustChangePassword) {
      router.replace(getDefaultRedirectForRole(user.role, false));
      return;
    }
    if (!requirePasswordChange && user?.mustChangePassword && (user.role === "ADMIN" || user.role === "STAFF")) {
      router.replace("/change-password");
    }
  }, [isAuthenticated, isLoading, user, router, allowedRoles, requirePasswordChange]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden />
          <p className="text-sm text-muted">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;
  if (requirePasswordChange && user && !user.mustChangePassword) return null;
  if (!requirePasswordChange && user?.mustChangePassword && (user.role === "ADMIN" || user.role === "STAFF")) return null;

  return <>{children}</>;
}
