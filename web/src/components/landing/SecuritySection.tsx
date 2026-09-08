"use client";

import { motion } from "framer-motion";
import {
  Building2,
  ClipboardList,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

const securityFeatures = [
  {
    icon: Lock,
    title: "Secure Platform Access",
    description: "Protected entry points with enterprise-grade authentication.",
  },
  {
    icon: KeyRound,
    title: "Role-Based Access",
    description: "Granular permissions tailored to each user role on campus.",
  },
  {
    icon: ShieldCheck,
    title: "Controlled Permissions",
    description: "Fine-grained control over who can view, manage, and respond.",
  },
  {
    icon: ClipboardList,
    title: "Audit-Ready Activity",
    description: "Comprehensive activity logs for compliance and review.",
  },
  {
    icon: Building2,
    title: "Organization Isolation",
    description: "Complete data separation between institutions and campuses.",
  },
  {
    icon: UserCheck,
    title: "Human-Controlled Decisions",
    description: "AI assists — administrators retain full authority over actions.",
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="relative overflow-hidden py-24 lg:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-navy/50 via-background to-background" />
      <div className="absolute inset-0 grid-pattern opacity-20" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Security Comes First
          </h2>
          <p className="mt-4 text-muted">
            Enterprise security architecture designed for educational institutions that demand
            trust, control, and accountability.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {securityFeatures.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                className="group rounded-2xl border border-border bg-glass p-7 transition-all hover:border-white/[0.12] hover:bg-glass"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-glass transition-colors group-hover:bg-accent/10">
                  <Icon className="h-5 w-5 text-foreground/70 transition-colors group-hover:text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-5 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
