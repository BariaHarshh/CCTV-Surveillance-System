"use client";

import { cn } from "@/lib/utils";
import type { PasswordStrength } from "@/lib/auth/password";

interface PasswordStrengthIndicatorProps {
  password: string;
  strength: PasswordStrength;
}

const strengthConfig = {
  weak: { label: "Weak", color: "bg-red-500", width: "w-1/3" },
  medium: { label: "Medium", color: "bg-amber-400", width: "w-2/3" },
  strong: { label: "Strong", color: "bg-emerald-400", width: "w-full" },
};

export function PasswordStrengthIndicator({
  password,
  strength,
}: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const config = strengthConfig[strength];

  return (
    <div className="mt-3" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">Password Strength</span>
        <span
          className={cn(
            "font-medium",
            strength === "weak" && "text-red-400",
            strength === "medium" && "text-amber-400",
            strength === "strong" && "text-emerald-400"
          )}
        >
          {config.label}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-glass">
        <div
          className={cn("h-full rounded-full transition-all duration-300", config.color, config.width)}
        />
      </div>
    </div>
  );
}
