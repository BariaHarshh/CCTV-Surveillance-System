"use client";

import { cn } from "@/lib/utils";

const STEPS = ["Organization", "Campus", "Purpose", "Contact", "Review"];

export function WizardProgress({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                i <= step ? "bg-accent text-background" : "bg-glass text-muted"
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <span className={cn("mt-2 hidden text-[10px] sm:block", i <= step ? "text-accent" : "text-muted")}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-border bg-glass px-4 py-2.5 text-sm outline-none focus:border-accent/40";

export const selectClass = inputClass;

export function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => (
        <label
          key={opt}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
            selected.includes(opt)
              ? "border-accent/40 bg-accent/10 text-white"
              : "border-border hover:bg-glass"
          )}
        >
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="rounded border-white/20"
          />
          {opt}
        </label>
      ))}
    </div>
  );
}
