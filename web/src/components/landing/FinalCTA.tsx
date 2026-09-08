"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section id="about" className="relative py-24 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(56,189,248,0.1),transparent)]" />

      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            The Future of Campus Safety Starts Here.
          </h2>
          <blockquote className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Move beyond passive surveillance and build a smarter, more proactive campus safety
            environment.
          </blockquote>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-10 inline-flex flex-wrap items-center justify-center gap-4"
          >
            <a
              href="#interest"
              className="group inline-flex items-center gap-3 rounded-full bg-accent px-10 py-4 text-base font-semibold text-background transition-all hover:bg-accent-dim hover:shadow-[0_0_50px_rgba(56,189,248,0.4)]"
            >
              Share your requirements
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-4 text-base font-medium text-white transition hover:bg-glass"
            >
              Enter platform
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
