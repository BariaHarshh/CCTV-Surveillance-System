"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  Camera,
  MapPin,
  Radio,
  Shield,
  Zap,
} from "lucide-react";

const nodes = [
  { id: "campus", label: "Campus", icon: MapPin, x: 12, y: 45, delay: 0 },
  { id: "cameras", label: "Cameras", icon: Camera, x: 28, y: 28, delay: 0.2 },
  { id: "ai", label: "AI Core", icon: Brain, x: 50, y: 38, delay: 0.4 },
  { id: "intel", label: "Intelligence", icon: Zap, x: 72, y: 25, delay: 0.6 },
  { id: "alert", label: "Alert", icon: AlertTriangle, x: 88, y: 42, delay: 0.8 },
];

const floatingCards = [
  { label: "Occupancy", value: "72%", x: "8%", y: "18%" },
  { label: "Risk Level", value: "Medium", x: "72%", y: "12%" },
  { label: "Active Zones", value: "24", x: "78%", y: "68%" },
];

export function HeroVisual() {
  return (
    <div className="relative aspect-square w-full max-w-xl lg:max-w-none lg:aspect-auto lg:h-[520px]">
      {/* Ambient glow */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent/10 via-transparent to-navy/40 blur-3xl" />

      <div className="gradient-border relative h-full overflow-hidden rounded-3xl bg-surface/60 backdrop-blur-sm">
        <div className="absolute inset-0 grid-pattern opacity-60" />
        <div className="absolute inset-0 noise-overlay" />

        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#030508_75%)]" />

        {/* Connection lines SVG */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 400 400"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(56,189,248,0.1)" />
              <stop offset="50%" stopColor="rgba(56,189,248,0.6)" />
              <stop offset="100%" stopColor="rgba(56,189,248,0.1)" />
            </linearGradient>
          </defs>
          {[
            [48, 180, 112, 112],
            [112, 112, 200, 152],
            [200, 152, 288, 100],
            [288, 100, 352, 168],
          ].map(([x1, y1, x2, y2], i) => (
            <motion.line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="url(#lineGrad)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.3 + i * 0.15, ease: "easeOut" }}
            />
          ))}
          {/* Animated data pulses */}
          {[0, 1, 2].map((pulse) => (
            <motion.circle
              key={pulse}
              r="3"
              fill="#38bdf8"
              initial={{ cx: 48, cy: 180, opacity: 0 }}
              animate={{
                cx: [48, 112, 200, 288, 352],
                cy: [180, 112, 152, 100, 168],
                opacity: [0, 1, 1, 1, 0],
              }}
              transition={{
                duration: 4,
                delay: pulse * 1.3,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const Icon = node.icon;
          return (
            <motion.div
              key={node.id}
              className="absolute"
              style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: node.delay, type: "spring", stiffness: 200 }}
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3 + node.delay, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="absolute -inset-3 rounded-full bg-accent/20 blur-md animate-pulse-glow" />
                <div className="gradient-border relative flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated/90 sm:h-14 sm:w-14">
                  <Icon className="h-5 w-5 text-accent sm:h-6 sm:w-6" strokeWidth={1.5} />
                </div>
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium tracking-wider text-muted uppercase sm:text-xs">
                  {node.label}
                </span>
              </motion.div>
            </motion.div>
          );
        })}

        {/* Floating intelligence cards */}
        {floatingCards.map((card, i) => (
          <motion.div
            key={card.label}
            className="absolute hidden sm:block"
            style={{ left: card.x, top: card.y }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 + i * 0.15 }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
              className="gradient-border rounded-lg bg-surface-elevated/80 px-3 py-2 backdrop-blur-md"
            >
              <p className="text-[10px] tracking-wider text-muted uppercase">{card.label}</p>
              <p className="font-mono text-sm font-semibold text-accent">{card.value}</p>
            </motion.div>
          </motion.div>
        ))}

        {/* Center shield indicator */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-accent/20 bg-accent/5">
            <Shield className="h-8 w-8 text-accent/80" strokeWidth={1.25} />
            <motion.div
              className="absolute inset-0 rounded-full border border-accent/30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
          </div>
        </motion.div>

        {/* Status indicators */}
        <div className="absolute bottom-4 left-4 flex items-center gap-3 sm:bottom-6 sm:left-6">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface-elevated/80 px-3 py-1.5 backdrop-blur-sm">
            <Radio className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] tracking-wider text-muted uppercase">System Ready</span>
          </div>
        </div>

        {/* Particle dots */}
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-accent/40"
            style={{
              left: `${15 + (i * 7) % 70}%`,
              top: `${20 + (i * 11) % 60}%`,
            }}
            animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.5, 1] }}
            transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}
