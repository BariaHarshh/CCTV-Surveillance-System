"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import {
  FormField,
  inputClass,
  selectClass,
} from "@/components/organizations/WizardUI";
import {
  ADMIN_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
  JOB_TITLES,
} from "@/lib/organizations/constants";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import type { AdminCreateInput } from "@/lib/organizations/schemas";
import { cn } from "@/lib/utils";

const PERMISSION_LABELS: Record<string, string> = {
  "org:view": "View Organization",
  "org:edit": "Edit Organization",
  "org:settings:view": "View Organization Settings",
  "staff:create": "Create Staff",
  "staff:view": "View Staff",
  "staff:edit": "Edit Staff",
  "staff:suspend": "Suspend Staff",
  "staff:activate": "Activate Staff",
  "staff:reset-password": "Reset Staff Password",
  "monitoring:dashboard": "View Dashboard",
  "monitoring:cameras": "View Cameras",
  "monitoring:alerts": "View Alerts",
  "monitoring:events": "View Events",
  "reports:view": "View Reports",
  "reports:export": "Export Reports",
  "security:activity": "View Security Activity",
  "security:sessions": "View Sessions",
};

const STEPS = ["Personal", "Professional", "Access", "Review"];

export function AdminWizard({
  user,
  organizationId,
  organizationName,
  organizationPublicId,
}: {
  user: SafeUser;
  organizationId: string;
  organizationName: string;
  organizationPublicId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [data, setData] = useState<AdminCreateInput>({
    personal: {
      name: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      gender: "",
      address: "",
      photo: "",
    },
    professional: {
      employeeId: "",
      jobTitle: "Campus Administrator",
      jobTitleOther: "",
      department: "",
      joiningDate: "",
      responsibilities: "",
    },
    account: { userId: "", password: "" },
    permissions: [...DEFAULT_ADMIN_PERMISSIONS],
  });

  const generateCredentials = async () => {
    setCredLoading(true);
    try {
      const res = await fetch("/api/super-admin/admins/generate-credentials", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setData((d) => ({
          ...d,
          account: { userId: json.userId, password: json.password },
        }));
      }
    } finally {
      setCredLoading(false);
    }
  };

  useEffect(() => {
    generateCredentials();
  }, []);

  const togglePermission = (perm: string) => {
    setData((d) => ({
      ...d,
      permissions: d.permissions.includes(perm)
        ? d.permissions.filter((p) => p !== perm)
        : [...d.permissions, perm],
    }));
  };

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/super-admin/organizations/${organizationId}/admins`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create administrator");

      const successKey = `acg_admin_success_${Date.now()}`;
      sessionStorage.setItem(
        successKey,
        JSON.stringify({
          name: json.admin.name,
          userId: json.admin.userId,
          orgName: organizationName,
          orgId: organizationPublicId,
          password: json.temporaryPassword,
          adminId: json.admin.id,
        })
      );
      router.push(`/super-admin/organizations/${organizationId}/admins/success?key=${successKey}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SuperAdminShell user={user}>
      <Link href={`/super-admin/organizations/${organizationId}`} className="text-sm text-muted hover:text-accent">
        ← Back to Organization
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Create Administrator</h1>
      <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm">
        <span className="text-muted">Organization</span>
        <p className="font-medium">{organizationName}</p>
        <p className="font-mono text-xs text-accent">{organizationPublicId}</p>
      </div>

      <div className="mx-auto mt-8 max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                i <= step ? "bg-accent text-background" : "bg-glass text-muted")}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <span className={cn("mt-2 hidden text-[10px] sm:block", i <= step ? "text-accent" : "text-muted")}>{label}</span>
            </div>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</p>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            className="gradient-border rounded-2xl bg-surface/60 p-6 sm:p-8">
            {step === 0 && (
              <>
                <h2 className="text-lg font-semibold">Admin Information</h2>
                <div className="mt-6 space-y-4">
                  <FormField label="Full Name" required>
                    <input className={inputClass} value={data.personal.name}
                      onChange={(e) => setData({ ...data, personal: { ...data.personal, name: e.target.value } })} />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Email" required>
                      <input type="email" className={inputClass} value={data.personal.email}
                        onChange={(e) => setData({ ...data, personal: { ...data.personal, email: e.target.value } })} />
                    </FormField>
                    <FormField label="Phone" required>
                      <input className={inputClass} value={data.personal.phone}
                        onChange={(e) => setData({ ...data, personal: { ...data.personal, phone: e.target.value } })} />
                    </FormField>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Date of Birth">
                      <input type="date" className={inputClass} value={data.personal.dateOfBirth}
                        onChange={(e) => setData({ ...data, personal: { ...data.personal, dateOfBirth: e.target.value } })} />
                    </FormField>
                    <FormField label="Gender">
                      <select className={selectClass} value={data.personal.gender}
                        onChange={(e) => setData({ ...data, personal: { ...data.personal, gender: e.target.value } })}>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </FormField>
                  </div>
                  <FormField label="Address">
                    <textarea className={inputClass + " min-h-[80px]"} value={data.personal.address}
                      onChange={(e) => setData({ ...data, personal: { ...data.personal, address: e.target.value } })} />
                  </FormField>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="text-lg font-semibold">Professional Information</h2>
                <div className="mt-6 space-y-4">
                  <FormField label="Employee ID" required>
                    <input className={inputClass} value={data.professional.employeeId}
                      onChange={(e) => setData({ ...data, professional: { ...data.professional, employeeId: e.target.value } })} />
                  </FormField>
                  <FormField label="Job Title" required>
                    <select className={selectClass} value={data.professional.jobTitle}
                      onChange={(e) => setData({ ...data, professional: { ...data.professional, jobTitle: e.target.value } })}>
                      {JOB_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormField>
                  {data.professional.jobTitle === "Other" && (
                    <FormField label="Specify Job Title" required>
                      <input className={inputClass} value={data.professional.jobTitleOther}
                        onChange={(e) => setData({ ...data, professional: { ...data.professional, jobTitleOther: e.target.value } })} />
                    </FormField>
                  )}
                  <FormField label="Department" required>
                    <input className={inputClass} value={data.professional.department}
                      onChange={(e) => setData({ ...data, professional: { ...data.professional, department: e.target.value } })} />
                  </FormField>
                  <FormField label="Joining Date">
                    <input type="date" className={inputClass} value={data.professional.joiningDate}
                      onChange={(e) => setData({ ...data, professional: { ...data.professional, joiningDate: e.target.value } })} />
                  </FormField>
                  <FormField label="Responsibilities">
                    <textarea className={inputClass + " min-h-[80px]"} value={data.professional.responsibilities}
                      onChange={(e) => setData({ ...data, professional: { ...data.professional, responsibilities: e.target.value } })} />
                  </FormField>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-lg font-semibold">Admin Access / Permissions</h2>
                <div className="mt-6 space-y-6">
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Admin ID</p>
                        <p className="font-mono text-accent">{data.account.userId || "Generating..."}</p>
                      </div>
                      <button type="button" disabled={credLoading} onClick={generateCredentials}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs">
                        <RefreshCw className={cn("h-3 w-3", credLoading && "animate-spin")} /> Regenerate
                      </button>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Temporary Password</p>
                        <button type="button" onClick={generateCredentials} className="text-xs text-accent">Generate Secure Password</button>
                      </div>
                      <div className="relative mt-2">
                        <input type={showPassword ? "text" : "password"} readOnly className={inputClass + " pr-10 font-mono"}
                          value={data.account.password} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted">Role: ADMIN — permissions stored on backend</p>
                  </div>

                  {Object.entries(ADMIN_PERMISSIONS).map(([category, perms]) => (
                    <div key={category}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{category}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {perms.map((perm) => (
                          <label key={perm} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                            data.permissions.includes(perm) ? "border-accent/40 bg-accent/10" : "border-border")}>
                            <input type="checkbox" checked={data.permissions.includes(perm)}
                              onChange={() => togglePermission(perm)} className="rounded" />
                            {PERMISSION_LABELS[perm] ?? perm}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-lg font-semibold">Review</h2>
                <div className="mt-6 space-y-4 text-sm">
                  {[
                    ["Personal", `${data.personal.name} · ${data.personal.email}`, () => setStep(0)],
                    ["Professional", `${data.professional.jobTitle} · ${data.professional.department}`, () => setStep(1)],
                    ["Organization", `${organizationName} (${organizationPublicId})`, undefined],
                    ["Access", `ADMIN · ${data.permissions.length} permissions`, () => setStep(2)],
                    ["Credentials", data.account.userId, () => setStep(2)],
                  ].map(([title, value, edit]) => (
                    <div key={title as string} className="flex justify-between rounded-xl border border-border p-4">
                      <div>
                        <p className="text-muted">{title as string}</p>
                        <p className="mt-1 font-medium">{value as string}</p>
                        {title === "Credentials" && (
                          <p className="mt-1 font-mono text-xs text-muted">{"•".repeat(12)} (shown once after creation)</p>
                        )}
                      </div>
                      {edit && <button type="button" onClick={edit as () => void} className="text-xs text-accent">Edit</button>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-8 flex justify-between">
              <button type="button" disabled={step === 0 || loading} onClick={() => setStep((s) => s - 1)}
                className="rounded-full border border-border px-6 py-2.5 text-sm disabled:opacity-40">Back</button>
              {step < 3 ? (
                <button type="button" onClick={() => setStep((s) => s + 1)}
                  className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background">Continue</button>
              ) : (
                <button type="button" disabled={loading} onClick={submit}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background disabled:opacity-70">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create Administrator"}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </SuperAdminShell>
  );
}
