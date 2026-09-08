"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Send } from "lucide-react";

const CAMPUS_TYPES = [
  "",
  "University",
  "College",
  "School",
  "Corporate Campus",
  "Hospital Campus",
  "Other",
];

export function InterestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organizationName: "",
    campusType: "",
    estimatedCameras: "",
    requirements: "",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send inquiry.");
      setSuccessId(data.inquiryId);
      setForm({
        name: "",
        email: "",
        phone: "",
        organizationName: "",
        campusType: "",
        estimatedCameras: "",
        requirements: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send inquiry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="interest" className="relative py-24 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(56,189,248,0.08),transparent)]" />
      <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="text-center"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Optional</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Interested in AI Campus Guardian?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Share your campus requirements with us. Our team will review your request and follow up.
            This form is optional — you do not need an account to send it.
          </p>
        </motion.div>

        {successId ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center"
          >
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="mt-4 text-lg font-semibold text-white">Requirements sent</p>
            <p className="mt-2 text-sm text-muted">
              Reference: <span className="font-mono text-accent">{successId}</span>
            </p>
            <p className="mt-2 text-sm text-muted">Our Super Admin team can now see your message.</p>
            <button
              type="button"
              onClick={() => setSuccessId("")}
              className="mt-6 text-sm text-accent hover:underline"
            >
              Send another inquiry
            </button>
          </motion.div>
        ) : (
          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 space-y-4 rounded-2xl border border-border bg-glass p-6 sm:p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name *" value={form.name} onChange={(v) => update("name", v)} required />
              <Field label="Work email *" type="email" value={form.email} onChange={(v) => update("email", v)} required />
              <Field label="Phone (optional)" value={form.phone} onChange={(v) => update("phone", v)} />
              <Field
                label="Organization / Campus *"
                value={form.organizationName}
                onChange={(v) => update("organizationName", v)}
                required
              />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Campus type (optional)</label>
                <select
                  value={form.campusType}
                  onChange={(e) => update("campusType", e.target.value)}
                  className="w-full rounded-xl border border-border bg-glass px-4 py-2.5 text-sm outline-none focus:border-accent/40"
                >
                  {CAMPUS_TYPES.map((t) => (
                    <option key={t || "blank"} value={t} className="bg-surface">
                      {t || "Select type"}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Estimated cameras (optional)"
                value={form.estimatedCameras}
                onChange={(v) => update("estimatedCameras", v)}
                placeholder="e.g. 50–100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Your requirements *</label>
              <textarea
                required
                rows={5}
                value={form.requirements}
                onChange={(e) => update("requirements", e.target.value)}
                placeholder="Describe what you need — buildings, cameras, AI detections, timeline, budget range, etc."
                className="w-full resize-y rounded-xl border border-border bg-glass px-4 py-3 text-sm outline-none focus:border-accent/40"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-background transition hover:bg-accent-dim disabled:opacity-60 sm:w-auto"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Sending..." : "Send requirements"}
            </button>
          </motion.form>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-glass px-4 py-2.5 text-sm outline-none focus:border-accent/40"
      />
    </div>
  );
}
