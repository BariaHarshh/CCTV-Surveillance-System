"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  className?: string;
  delay?: number;
}

export function StatCard({ label, value, icon: Icon, trend, className, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "gradient-border rounded-2xl bg-surface/60 p-5 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wider text-muted uppercase">{label}</p>
          <p className="mt-3 font-mono text-3xl font-semibold tracking-tight">{value}</p>
          {trend && <p className="mt-2 text-xs text-muted">{trend}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
          <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
        </div>
      </div>
    </motion.div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-surface/40 p-5">
      <div className="h-3 w-24 rounded bg-glass" />
      <div className="mt-4 h-8 w-16 rounded bg-white/[0.08]" />
    </div>
  );
}
