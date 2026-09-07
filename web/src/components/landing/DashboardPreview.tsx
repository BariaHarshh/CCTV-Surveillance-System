"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Camera,
  Clock,
  DoorOpen,
  Gauge,
  Users,
  Video,
} from "lucide-react";

const statCards = [
  { icon: Users, label: "People", value: "847", sub: "On campus" },
  { icon: AlertTriangle, label: "Active Alerts", value: "3", sub: "Requires review" },
  { icon: Gauge, label: "Risk Score", value: "42", sub: "Low" },
  { icon: Camera, label: "Camera Status", value: "98%", sub: "Operational" },
  { icon: DoorOpen, label: "Room Status", value: "156", sub: "Monitored" },
  { icon: Clock, label: "Event Timeline", value: "24", sub: "Last hour" },
];

const timelineEvents = [
  { time: "14:32", event: "Motion detected — Building C", type: "info" },
  { time: "14:28", event: "Occupancy threshold — Room 204", type: "warn" },
  { time: "14:15", event: "Camera health check passed", type: "success" },
  { time: "14:02", event: "After-hours zone clear", type: "info" },
];

export function DashboardPreview() {
  return (
    <section className="relative border-t border-border py-24 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(56,189,248,0.05),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[10px] font-semibold tracking-widest text-accent uppercase">
            Platform Preview
          </span>
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Command Center View
          </h2>
          <p className="mt-4 max-w-xl text-muted">
            A unified dashboard bringing together live camera feeds, occupancy data, alerts,
            risk scores, and event timelines — all in one intelligent interface.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="gradient-border mt-16 overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-sm"
        >
          {/* Dashboard header bar */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">Campus Overview</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-glow" />
              <span className="text-xs text-muted">Preview Mode</span>
            </div>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-3 lg:gap-6 lg:p-8">
            {/* Stat cards grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-3">
              {statCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-border bg-surface-elevated/60 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-accent/70" strokeWidth={1.5} />
                      <span className="text-xs text-muted">{card.label}</span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-semibold">{card.value}</p>
                    <p className="text-[11px] text-muted/70">{card.sub}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Live camera panel */}
            <div className="rounded-xl border border-border bg-surface-elevated/60 p-4 lg:row-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold tracking-wider uppercase">
                    Live Camera
                  </span>
                </div>
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
                  PREVIEW
                </span>
              </div>
              <div className="relative mt-4 aspect-video overflow-hidden rounded-lg bg-graphite">
                <div className="absolute inset-0 grid-pattern opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="h-10 w-10 text-white/20" strokeWidth={1} />
                </div>
                {/* Scan line effect */}
                <motion.div
                  className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-foreground/70">
                  CAM-042 · Building A
                </div>
              </div>
            </div>

            {/* Event timeline */}
            <div className="rounded-xl border border-border bg-surface-elevated/60 p-4 lg:col-span-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent/70" />
                <span className="text-xs font-semibold tracking-wider text-muted uppercase">
                  Event Timeline
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {timelineEvents.map((item, i) => (
                  <motion.div
                    key={item.time + item.event}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-4 border-b border-white/[0.04] pb-3 last:border-0 last:pb-0"
                  >
                    <span className="font-mono text-xs text-muted">{item.time}</span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.type === "warn"
                          ? "bg-amber-400"
                          : item.type === "success"
                            ? "bg-emerald-400"
                            : "bg-accent/60"
                      }`}
                    />
                    <span className="text-sm text-foreground/80">{item.event}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
