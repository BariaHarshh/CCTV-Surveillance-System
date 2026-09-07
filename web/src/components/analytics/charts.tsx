"use client";

import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb7185", "#2dd4bf"];

export function TrendLineChart({
  data,
  dataKey = "count",
  xKey = "period",
}: {
  data: Array<Record<string, unknown>>;
  dataKey?: string;
  xKey?: string;
}) {
  if (!data.length) {
    return <EmptyChart />;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey={xKey} tick={{ fill: "#94a3b8", fontSize: 10 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }} />
          <Line type="monotone" dataKey={dataKey} stroke="#38bdf8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RankBarChart({
  data,
  dataKey = "events",
  nameKey = "location",
}: {
  data: Array<Record<string, unknown>>;
  dataKey?: string;
  nameKey?: string;
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} allowDecimals={false} />
          <YAxis type="category" dataKey={nameKey} width={100} tick={{ fill: "#94a3b8", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }} />
          <Bar dataKey={dataKey} fill="#38bdf8" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompositionDonut({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length || data.every((d) => d.value === 0)) return <EmptyChart />;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted">
      No data available for this period.
    </div>
  );
}

export function KpiCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string | number;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-border bg-surface/50 p-4 transition hover:border-white/20">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-muted">{hint}</p>}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

export function AnalyticsFiltersBar({
  filters,
  onChange,
}: {
  filters: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <input
        type="date"
        value={filters.from ?? ""}
        onChange={(e) => onChange({ ...filters, from: e.target.value })}
        className="rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs"
      />
      <input
        type="date"
        value={filters.to ?? ""}
        onChange={(e) => onChange({ ...filters, to: e.target.value })}
        className="rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs"
      />
      <select
        value={filters.severity ?? ""}
        onChange={(e) => onChange({ ...filters, severity: e.target.value })}
        className="rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs"
      >
        <option value="">All Severities</option>
        {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        value={filters.granularity ?? "day"}
        onChange={(e) => onChange({ ...filters, granularity: e.target.value })}
        className="rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs"
      >
        <option value="day">Daily</option>
        <option value="week">Weekly</option>
        <option value="month">Monthly</option>
      </select>
    </div>
  );
}

export function qs(filters: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) p.set(k, v);
  }
  return p.toString();
}
