import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  ACTIVE: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  INACTIVE: "border-slate-500/20 bg-slate-500/10 text-slate-400",
  SUSPENDED: "border-red-500/20 bg-red-500/10 text-red-400",
  PENDING: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  LOCKED: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  operational: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  degraded: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  connected: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  disconnected: "border-red-500/20 bg-red-500/10 text-red-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        statusStyles[status] ?? "border-border bg-white/5 text-muted"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
