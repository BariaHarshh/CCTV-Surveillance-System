"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { HeroVisual } from "./HeroVisual";

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-16">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -20%, var(--color-accent-glow), transparent)",
        }}
      />
      <div className="absolute inset-0 opacity-40 [background:radial-gradient(ellipse_60%_40%_at_80%_50%,var(--color-navy),transparent)]" />
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <div className="relative mx-auto grid max-w-7xl flex-1 items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
        {/* Content */}
        <div className="order-2 lg:order-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-[11px] font-semibold tracking-[0.15em] text-accent uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-glow" />
              AI-Powered Campus Safety
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            <span className="gradient-text">SEE. UNDERSTAND. PROTECT.</span>
          </motion.h1>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-6 text-lg font-medium text-foreground/90 sm:text-xl lg:text-2xl"
          >
            From Passive CCTV to Proactive AI-Powered Campus Safety
          </motion.h2>

          <motion.blockquote
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-6 border-l-2 border-accent/40 pl-5 text-base leading-relaxed text-muted sm:text-lg"
          >
            AI Campus Guardian transforms campus surveillance into intelligent safety
            intelligence — helping institutions detect events, understand situations, assess
            risk, and respond faster.
          </motion.blockquote>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
          >
            <Link
              href="/login"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-background transition-all hover:bg-accent-dim hover:shadow-[0_0_40px_rgba(56,189,248,0.35)]"
            >
              Access Platform
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#platform"
              className="gradient-border inline-flex items-center justify-center gap-2 rounded-full bg-glass px-8 py-3.5 text-sm font-medium text-foreground transition-all hover:bg-glass-hover"
            >
              Explore Intelligence
              <ChevronDown className="h-4 w-4" />
            </a>
          </motion.div>
        </div>

        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="order-1 lg:order-2"
        >
          <HeroVisual />
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 lg:block"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-2 text-muted"
        >
          <span className="text-[10px] tracking-widest uppercase">Scroll</span>
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.div>
    </section>
  );
}
