"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Box, DoorOpen, Users, AlertOctagon } from "lucide-react";
import { useEffect, useRef } from "react";

const riskEvents = [
  { icon: DoorOpen, label: "Restricted Entry", severity: "high" },
  { icon: Box, label: "Abandoned Object", severity: "critical" },
  { icon: Users, label: "High Occupancy", severity: "medium" },
];

function AnimatedScore({ target }: { target: number }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 50, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          motionValue.set(target);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [motionValue, target]);

  useEffect(() => {
    const unsubscribe = display.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(v);
    });
    return unsubscribe;
  }, [display]);

  return <span ref={ref}>0</span>;
}

export function RiskEngine() {
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-navy/30 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[10px] font-semibold tracking-widest text-amber-400 uppercase">
              Concept Preview
            </span>
            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              Intelligent Risk Assessment
            </h2>
            <p className="mt-4 max-w-md text-muted">
              Multiple campus events are combined into a single, understandable risk score —
              helping administrators prioritize response and make informed decisions.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="gradient-border glow-accent relative overflow-hidden rounded-3xl bg-surface-elevated/80 p-8 backdrop-blur-sm lg:p-10"
          >
            <div className="absolute inset-0 grid-pattern opacity-40" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
                    Risk Score
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-5xl font-bold text-white lg:text-6xl">
                      <AnimatedScore target={85} />
                    </span>
                    <span className="text-xl text-muted">/ 100</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">
                  <AlertOctagon className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-semibold tracking-wider text-red-400 uppercase">
                    Critical
                  </span>
                </div>
              </div>

              {/* Progress ring visual */}
              <div className="relative mx-auto my-10 h-3 overflow-hidden rounded-full bg-glass">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "85%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"
                />
              </div>

              <div className="space-y-3">
                {riskEvents.map((event, i) => {
                  const Icon = event.icon;
                  const colors = {
                    critical: "border-red-500/20 bg-red-500/5 text-red-400",
                    high: "border-orange-500/20 bg-orange-500/5 text-orange-400",
                    medium: "border-amber-500/20 bg-amber-500/5 text-amber-400",
                  };
                  return (
                    <motion.div
                      key={event.label}
                      initial={{ opacity: 0, x: 16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className={`flex items-center gap-4 rounded-xl border p-4 ${colors[event.severity as keyof typeof colors]}`}
                    >
                      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                      <span className="text-sm font-medium text-foreground/90">{event.label}</span>
                      <span className="ml-auto text-[10px] tracking-wider uppercase opacity-70">
                        {event.severity}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
