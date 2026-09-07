"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Camera,
  MapPin,
  Radio,
  Shield,
  Zap,
} from "lucide-react";

const nodes = [
  { icon: MapPin, label: "Campus", x: "15%", y: "35%" },
  { icon: Camera, label: "Cameras", x: "35%", y: "20%" },
  { icon: Brain, label: "AI Core", x: "55%", y: "40%" },
  { icon: Zap, label: "Intel", x: "75%", y: "25%" },
  { icon: Shield, label: "Secure", x: "85%", y: "55%" },
];

export function LoginVisual() {
  return (
    <div className="relative hidden h-full min-h-[600px] overflow-hidden lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_40%,rgba(56,189,248,0.12),transparent)]" />
      <div className="absolute inset-0 grid-pattern opacity-40" />
      <div className="absolute inset-0 noise-overlay" />

      <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-accent">
            AI CAMPUS GUARDIAN
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            <span className="gradient-text">SEE. UNDERSTAND. PROTECT.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
            Secure access to intelligent campus safety — where surveillance becomes
            proactive protection.
          </p>
        </div>

        <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
          <div className="gradient-border absolute inset-0 overflow-hidden rounded-2xl bg-surface/40 backdrop-blur-sm">
            <div className="absolute inset-0 grid-pattern opacity-50" />

            {/* Campus outline */}
            <svg
              className="absolute inset-0 h-full w-full opacity-20"
              viewBox="0 0 400 300"
              aria-hidden
            >
              <rect x="60" y="80" width="120" height="80" rx="4" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
              <rect x="200" y="60" width="140" height="100" rx="4" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
              <rect x="100" y="180" width="200" height="60" rx="4" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
            </svg>

            {nodes.map((node, i) => {
              const Icon = node.icon;
              return (
                <motion.div
                  key={node.label}
                  className="absolute"
                  style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="gradient-border flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated/90">
                      <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}

            {/* Data streams */}
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute h-px w-24 bg-gradient-to-r from-transparent via-accent/50 to-transparent"
                style={{ left: `${20 + i * 25}%`, top: `${30 + i * 15}%`, rotate: `${15 + i * 20}deg` }}
                animate={{ opacity: [0.2, 0.8, 0.2], scaleX: [0.8, 1.2, 0.8] }}
                transition={{ duration: 2.5 + i, repeat: Infinity }}
              />
            ))}

            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-border bg-surface-elevated/80 px-3 py-1.5">
              <Radio className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] tracking-wider text-muted uppercase">
                Secure Connection
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
