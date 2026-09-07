"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface ChartItem {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  title: string;
  data: ChartItem[];
}

export function DonutChart({ title, data }: DonutChartProps) {
  const filtered = data.filter((d) => d.value > 0);
  const isEmpty = filtered.length === 0;

  return (
    <div className="gradient-border rounded-2xl bg-surface/60 p-6">
      <h3 className="text-sm font-semibold tracking-wide text-foreground/90">{title}</h3>
      {isEmpty ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted">No data yet</div>
      ) : (
        <div className="mt-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filtered}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {filtered.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#111820",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {filtered.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.name}: {item.value}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
