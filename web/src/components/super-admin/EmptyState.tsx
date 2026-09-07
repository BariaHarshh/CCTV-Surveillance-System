"use client";

import { Building2, Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: "building" | "inbox";
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = "inbox",
}: EmptyStateProps) {
  const Icon = icon === "building" ? Building2 : Inbox;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
        <Icon className="h-7 w-7 text-accent/70" strokeWidth={1.25} />
      </div>
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background hover:bg-accent-dim"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
