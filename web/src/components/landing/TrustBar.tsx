"use client";

import { motion } from "framer-motion";

const badges = [
  "REAL-TIME READY",
  "SECURE ACCESS",
  "CAMPUS-FIRST",
  "HUMAN-CONTROLLED",
];

export function TrustBar() {
  return (
    <section className="border-y border-border bg-surface/40 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
            AI Intelligence Platform
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {badges.map((badge, i) => (
              <motion.span
                key={badge}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-full border border-border bg-glass px-4 py-1.5 font-mono text-[10px] tracking-wider text-foreground/70 sm:text-xs"
              >
                {badge}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
