"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { AdminShell } from "./AdminShell";
import { FormField, inputClass, selectClass } from "@/components/organizations/WizardUI";
import {
  ALL_STAFF_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  EMPLOYMENT_TYPES,
  STAFF_PERMISSION_LABELS,
} from "@/lib/staff/constants";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import type { StaffCreateInput } from "@/lib/staff/schemas";
import { cn } from "@/lib/utils";

const STEPS = ["Personal", "Professional", "Account", "Permissions", "Review"];

export function StaffWizard({ user }: { user: SafeUser }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [orgInfo, setOrgInfo] = useState({ name: "", organizationId: "" });

  const [data, setData] = useState<StaffCreateInput>({
    personal: {
      name: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      gender: "",
      address: "",
      photo: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
    },
    professional: {
      employeeId: "",
      jobTitle: "",
      department: "",
      designation: "",
      employmentType: "Full Time",
      joiningDate: "",
      responsibilities: "",
    },
    account: { userId: "", password: "" },
    permissions: [...DEFAULT_STAFF_PERMISSIONS],
  });

  useEffect(() => {
    fetch("/api/admin/organization", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.organization) {
          setOrgInfo({ name: j.organization.name, organizationId: j.organization.organizationId });
        }
      });
    generateCredentials();
  }, []);

  const generateCredentials = async () => {
    setCredLoading(true);
    try {
      const res = await fetch("/api/admin/staff/generate-credentials", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setData((d) => ({ ...d, account: { userId: json.userId, password: json.password } }));
      }
    } finally {
      setCredLoading(false);
    }
  };

  const togglePermission = (perm: string) => {
    setData((d) => ({
      ...d,
      permissions: d.permissions.includes(perm) ? d.permissions.filter((p) => p !== perm) : [...d.permissions, perm],
    }));
  };

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create staff");

      const payload = {
        name: json.staff.name,
        userId: json.staff.userId,
        password: json.temporaryPassword,
        staffId: json.staff.id,
        orgName: json.organizationName,
        orgId: json.organizationPublicId,
      };

      const key = `acg_staff_success_${Date.now()}`;
      sessionStorage.setItem(key, JSON.stringify(payload));
      sessionStorage.setItem("acg_staff_success_latest", JSON.stringify(payload));

      const qs = new URLSearchParams({
        key,
        staffId: json.staff.id,
        name: json.staff.name,
        userId: json.staff.userId,
        orgName: json.organizationName ?? "",
        orgId: json.organizationPublicId ?? "",
      });
      router.push(`/admin/staff/success?${qs.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell user={user}>
      <Link href="/admin/staff" className="text-sm text-muted hover:text-accent">← Back to Staff</Link>
      <h1 className="mt-2 text-2xl font-bold">Create Staff Account</h1>

      <div className="mx-auto mt-8 max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold", i <= step ? "bg-accent text-background" : "bg-glass text-muted")}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <span className={cn("mt-2 hidden text-[10px] sm:block", i <= step ? "text-accent" : "text-muted")}>{label}</span>
            </div>
          ))}
        </div>

        {error && <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</p>}

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="gradient-border rounded-2xl bg-surface/60 p-6 sm:p-8">
            {step === 0 && (
              <>
                <h2 className="text-lg font-semibold">Personal Information</h2>
                <div className="mt-6 space-y-4">
                  <FormField label="Full Name" required><input className={inputClass} value={data.personal.name} onChange={(e) => setData({ ...data, personal: { ...data.personal, name: e.target.value } })} /></FormField>
                  <FormField label="Profile Photo URL"><input className={inputClass} value={data.personal.photo} onChange={(e) => setData({ ...data, personal: { ...data.personal, photo: e.target.value } })} placeholder="https://..." /></FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Email" required><input type="email" className={inputClass} value={data.personal.email} onChange={(e) => setData({ ...data, personal: { ...data.personal, email: e.target.value } })} /></FormField>
                    <FormField label="Phone" required><input className={inputClass} value={data.personal.phone} onChange={(e) => setData({ ...data, personal: { ...data.personal, phone: e.target.value } })} /></FormField>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Date of Birth"><input type="date" className={inputClass} value={data.personal.dateOfBirth} onChange={(e) => setData({ ...data, personal: { ...data.personal, dateOfBirth: e.target.value } })} /></FormField>
                    <FormField label="Gender"><select className={selectClass} value={data.personal.gender} onChange={(e) => setData({ ...data, personal: { ...data.personal, gender: e.target.value } })}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></FormField>
                  </div>
                  <FormField label="Address"><textarea className={inputClass + " min-h-[80px]"} value={data.personal.address} onChange={(e) => setData({ ...data, personal: { ...data.personal, address: e.target.value } })} /></FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Emergency Contact Name"><input className={inputClass} value={data.personal.emergencyContactName} onChange={(e) => setData({ ...data, personal: { ...data.personal, emergencyContactName: e.target.value } })} /></FormField>
                    <FormField label="Emergency Contact Phone"><input className={inputClass} value={data.personal.emergencyContactPhone} onChange={(e) => setData({ ...data, personal: { ...data.personal, emergencyContactPhone: e.target.value } })} /></FormField>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="text-lg font-semibold">Professional Information</h2>
                <div className="mt-6 space-y-4">
                  <FormField label="Employee ID" required><input className={inputClass} value={data.professional.employeeId} onChange={(e) => setData({ ...data, professional: { ...data.professional, employeeId: e.target.value } })} /></FormField>
                  <FormField label="Job Title" required><input className={inputClass} value={data.professional.jobTitle} onChange={(e) => setData({ ...data, professional: { ...data.professional, jobTitle: e.target.value } })} /></FormField>
                  <FormField label="Department" required><input className={inputClass} value={data.professional.department} onChange={(e) => setData({ ...data, professional: { ...data.professional, department: e.target.value } })} /></FormField>
                  <FormField label="Designation"><input className={inputClass} value={data.professional.designation} onChange={(e) => setData({ ...data, professional: { ...data.professional, designation: e.target.value } })} /></FormField>
                  <FormField label="Employment Type"><select className={selectClass} value={data.professional.employmentType} onChange={(e) => setData({ ...data, professional: { ...data.professional, employmentType: e.target.value as StaffCreateInput["professional"]["employmentType"] } })}>{EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></FormField>
                  <FormField label="Joining Date"><input type="date" className={inputClass} value={data.professional.joiningDate} onChange={(e) => setData({ ...data, professional: { ...data.professional, joiningDate: e.target.value } })} /></FormField>
                  <FormField label="Responsibilities"><textarea className={inputClass + " min-h-[80px]"} value={data.professional.responsibilities} onChange={(e) => setData({ ...data, professional: { ...data.professional, responsibilities: e.target.value } })} /></FormField>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-lg font-semibold">Account</h2>
                <div className="mt-6 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Staff ID</p><p className="font-mono text-accent">{data.account.userId || "Generating..."}</p></div>
                    <button type="button" disabled={credLoading} onClick={generateCredentials} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"><RefreshCw className={cn("h-3 w-3", credLoading && "animate-spin")} /> Regenerate</button>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium">Generate Secure Password</p><button type="button" onClick={generateCredentials} className="text-xs text-accent">Regenerate</button></div>
                    <div className="relative mt-2">
                      <input type={showPassword ? "text" : "password"} readOnly className={inputClass + " pr-10 font-mono"} value={data.account.password} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted">Role: STAFF · Status: ACTIVE · mustChangePassword on first login</p>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-lg font-semibold">Permissions</h2>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {ALL_STAFF_PERMISSIONS.map((perm) => (
                    <label key={perm} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm", data.permissions.includes(perm) ? "border-accent/40 bg-accent/10" : "border-border")}>
                      <input type="checkbox" checked={data.permissions.includes(perm)} onChange={() => togglePermission(perm)} />
                      {STAFF_PERMISSION_LABELS[perm] ?? perm}
                    </label>
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h2 className="text-lg font-semibold">Review</h2>
                <div className="mt-6 space-y-3 text-sm">
                  <div className="rounded-xl border border-border p-4"><p className="text-muted">Personal</p><p className="mt-1 font-medium">{data.personal.name} · {data.personal.email} · {data.personal.phone}</p></div>
                  <div className="rounded-xl border border-border p-4"><p className="text-muted">Professional</p><p className="mt-1 font-medium">{data.professional.employeeId} · {data.professional.department} · {data.professional.jobTitle}</p></div>
                  <div className="rounded-xl border border-border p-4"><p className="text-muted">Organization</p><p className="mt-1 font-medium">{orgInfo.name} ({orgInfo.organizationId})</p></div>
                  <div className="rounded-xl border border-border p-4"><p className="text-muted">Access</p><p className="mt-1 font-medium">STAFF · {data.permissions.length} permissions</p></div>
                  <div className="rounded-xl border border-border p-4"><p className="text-muted">Credentials</p><p className="mt-1 font-mono font-medium">{data.account.userId}</p><p className="mt-1 font-mono text-xs text-muted">Temporary password shown once after creation</p></div>
                </div>
              </>
            )}

            <div className="mt-8 flex justify-between">
              <button type="button" disabled={step === 0 || loading} onClick={() => setStep((s) => s - 1)} className="rounded-full border border-border px-6 py-2.5 text-sm disabled:opacity-40">Back</button>
              {step < 4 ? (
                <button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background">Continue</button>
              ) : (
                <button type="button" disabled={loading} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background disabled:opacity-70">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create Staff Account"}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </AdminShell>
  );
}
