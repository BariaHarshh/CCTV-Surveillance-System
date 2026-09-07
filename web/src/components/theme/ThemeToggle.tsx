"use client";

import { useId } from "react";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/components/theme/ThemeProvider";

type ThemeToggleProps = {
  className?: string;
  size?: "sm" | "md";
};

export function ThemeToggle({ className, size = "md" }: ThemeToggleProps) {
  const { theme, setTheme, ready } = useTheme();
  const compact = size === "sm";
  const pillId = useId();

  const options: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: "day", label: "Day", icon: Sun },
    { id: "night", label: "Night", icon: Moon },
  ];

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={cn(
        "relative inline-flex items-center rounded-full border border-border bg-glass p-0.5 shadow-sm theme-transition",
        className
      )}
    >
      {options.map(({ id, label, icon: Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            disabled={!ready}
            aria-pressed={active}
            aria-label={`${label} mode`}
            onClick={() => setTheme(id)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors",
              compact ? "h-8 w-8" : "h-8 px-3 text-xs",
              active ? "text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`acg-theme-pill-${pillId}`}
                className="absolute inset-0 rounded-full bg-surface-elevated shadow-[var(--shadow-panel)] ring-1 ring-border-strong"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <Icon className="relative z-10 h-3.5 w-3.5" aria-hidden />
            {!compact && <span className="relative z-10 hidden sm:inline">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
