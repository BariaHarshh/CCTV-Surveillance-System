"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Box,
  Clock,
  DoorClosed,
  Gauge,
  Users,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Classroom Intelligence",
    description: "Monitor classroom occupancy and identify overcrowding.",
  },
  {
    icon: DoorClosed,
    title: "Restricted Area Detection",
    description: "Identify activity inside restricted areas.",
  },
  {
    icon: Clock,
    title: "After-Hours Monitoring",
    description: "Detect activity during campus closing hours.",
  },
  {
    icon: Box,
    title: "Abandoned Object Detection",
    description: "Identify potentially unattended objects.",
  },
  {
    icon: Gauge,
    title: "Risk Assessment",
    description: "Combine events into an understandable risk score.",
  },
  {
    icon: AlertTriangle,
    title: "Real-Time Alerts",
    description: "Bring important events to administrators quickly.",
  },
];

export function CoreIntelligence() {
  return (
    <section id="intelligence" className="relative border-t border-border py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Built for Campus Safety
          </h2>
          <p className="mt-4 text-muted">
            Core intelligence capabilities designed for educational institutions and their
            unique safety requirements.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                whileHover={{ y: -4 }}
                className="group gradient-border rounded-2xl bg-surface/60 p-7 transition-all hover:bg-surface-elevated/60 hover:shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/5 transition-all group-hover:border-accent/40 group-hover:bg-accent/10 group-hover:shadow-[0_0_24px_rgba(56,189,248,0.15)]">
                  <Icon className="h-6 w-6 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
