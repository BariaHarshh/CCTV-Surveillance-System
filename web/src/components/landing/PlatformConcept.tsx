"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  Eye,
  GitBranch,
  Scan,
  Target,
} from "lucide-react";

const stages = [
  {
    number: "01",
    icon: Eye,
    title: "Detect",
    description: "Identify events across campus camera networks in real time.",
  },
  {
    number: "02",
    icon: GitBranch,
    title: "Track",
    description: "Follow activity patterns and movement across monitored zones.",
  },
  {
    number: "03",
    icon: Scan,
    title: "Understand",
    description: "Apply AI intelligence to interpret what is happening on campus.",
  },
  {
    number: "04",
    icon: Target,
    title: "Assess",
    description: "Evaluate situational context and compute meaningful risk levels.",
  },
  {
    number: "05",
    icon: AlertCircle,
    title: "Alert",
    description: "Deliver actionable notifications to administrators when it matters.",
  },
];

export function PlatformConcept() {
  return (
    <section id="platform" className="relative py-24 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_100%,rgba(56,189,248,0.06),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Turn Cameras Into Intelligence
          </h2>
          <p className="mt-4 text-muted">
            The core intelligence pipeline that transforms passive surveillance into proactive
            campus safety.
          </p>
        </motion.div>

        {/* Flow indicator - desktop */}
        <div className="mt-16 hidden justify-center lg:flex">
          <div className="flex items-center gap-2">
            {stages.map((stage, i) => (
              <div key={stage.title} className="flex items-center">
                <span className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
                  {stage.title}
                </span>
                {i < stages.length - 1 && (
                  <span className="mx-4 text-muted/50">↓</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-5 lg:gap-5">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <motion.div
                key={stage.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="group gradient-border relative rounded-2xl bg-surface-elevated/50 p-6 backdrop-blur-sm transition-shadow hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
              >
                <span className="font-mono text-xs text-accent/60">{stage.number}</span>
                <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 transition-colors group-hover:bg-accent/20">
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{stage.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{stage.description}</p>

                {/* Mobile flow arrow */}
                {i < stages.length - 1 && (
                  <div className="mt-4 flex justify-center text-accent/40 lg:hidden">↓</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
