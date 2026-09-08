"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function DashboardPreviewContent() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.08),transparent)]" />
      <div className="absolute inset-0 grid-pattern opacity-20" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="gradient-border relative max-w-lg rounded-3xl bg-surface/80 p-10 text-center backdrop-blur-sm"
      >
        <Construction className="mx-auto h-12 w-12 text-accent" strokeWidth={1.5} />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          Dashboard Coming in the Next Development Step
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Role-based dashboards for Super Admin, Admin, and Staff will be built in Step 3.
          Your authentication session is active and secure.
        </p>
        <Link
          href="/authenticated"
          className="mt-8 inline-flex items-center gap-2 text-sm text-accent hover:text-accent-dim"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Authentication
        </Link>
      </motion.div>
    </div>
  );
}

export default function DashboardPreviewPage() {
  return (
    <ProtectedRoute>
      <DashboardPreviewContent />
    </ProtectedRoute>
  );
}
