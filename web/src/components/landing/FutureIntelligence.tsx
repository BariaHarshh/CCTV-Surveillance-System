"use client";

import { motion } from "framer-motion";
import {
  Flame,
  GraduationCap,
  HardHat,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

const futureFeatures = [
  { icon: GraduationCap, title: "Faculty Presence", description: "Track faculty availability across campus zones." },
  { icon: ShieldAlert, title: "Unusual Activity", description: "Detect anomalous behavior patterns automatically." },
  { icon: Flame, title: "Fire & Smoke", description: "Early detection of fire and smoke events." },
  { icon: HardHat, title: "PPE Detection", description: "Verify personal protective equipment compliance." },
  { icon: TrendingUp, title: "Predictive Intrusion", description: "Anticipate potential security breaches before they occur." },
];

export function FutureIntelligence() {
  return (
    <section className="relative border-t border-border py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            The Platform Evolves
          </h2>
          <p className="mt-4 text-muted">
            Advanced capabilities on the roadmap to expand campus intelligence even further.
          </p>
        </motion.div>

        <div className="mt-12 overflow-x-auto pb-4">
          <div className="flex min-w-max gap-5 px-1 lg:min-w-0 lg:grid lg:grid-cols-5">
            {futureFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="group w-64 shrink-0 gradient-border rounded-2xl bg-surface/50 p-6 lg:w-auto"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
                    </div>
                    <span className="rounded-full border border-accent/20 bg-accent/5 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent uppercase">
                      Advanced
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
