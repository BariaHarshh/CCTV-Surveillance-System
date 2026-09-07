"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginVisual } from "@/components/auth/LoginVisual";
import { LoginForm } from "@/components/auth/LoginForm";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function LoginFormFallback() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" aria-label="Loading" />
    </div>
  );
}

export function LoginPageContent() {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -20%, var(--color-accent-glow), transparent)",
        }}
      />
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="relative grid min-h-screen w-full lg:grid-cols-2">
        <LoginVisual />
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
