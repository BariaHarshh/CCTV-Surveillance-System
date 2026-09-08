"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import {
  WizardProgress,
  FormField,
  inputClass,
  selectClass,
  CheckboxGroup,
} from "@/components/organizations/WizardUI";
import {
  ORGANIZATION_TYPES,
  CAMPUS_TYPES,
  USE_CASES,
  SAFETY_PRIORITIES,
} from "@/lib/organizations/constants";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import type { OrganizationCreateInput } from "@/lib/organizations/schemas";

const initialData: OrganizationCreateInput = {
  basicInformation: {
    name: "",
    legalName: "",
    type: "University",
    typeOther: "",
    registrationNumber: "",
    website: "",
    email: "",
    phone: "",
    logo: "",
  },
  location: { country: "", state: "", city: "", address: "", postalCode: "" },
  campus: {
    name: "",
    type: "Main Campus",
    buildings: 0,
    classrooms: 0,
    laboratories: 0,
    cameras: 0,
    students: 0,
    faculty: 0,
    securityPersonnel: 0,
  },
  purpose: { useCases: [], description: "", safetyPriorities: [] },
  primaryContact: {
    name: "",
    title: "",
    department: "",
    email: "",
    phone: "",
    preferredMethod: "Email",
  },
  status: "ACTIVE",
};

export function OrganizationWizard({ user }: { user: SafeUser }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OrganizationCreateInput>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = <K extends keyof OrganizationCreateInput>(
    key: K,
    value: OrganizationCreateInput[K]
  ) => setData((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/super-admin/organizations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create organization");
      router.push(
        `/super-admin/organizations/success?id=${json.organization.id}&orgId=${encodeURIComponent(json.organization.organizationId)}&name=${encodeURIComponent(json.organization.name)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SuperAdminShell user={user}>
      <h1 className="text-2xl font-bold">Create Organization</h1>
      <p className="mt-1 text-muted">Register a new institution on AI Campus Guardian</p>
      <div className="mx-auto mt-8 max-w-3xl">
        <WizardProgress step={step} />
        {error && (
          <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="gradient-border rounded-2xl bg-surface/60 p-6 sm:p-8"
          >
            {step === 0 && (
              <>
                <h2 className="text-lg font-semibold">Tell us about the organization</h2>
                <div className="mt-6 space-y-4">
                  <FormField label="Organization Name" required>
                    <input className={inputClass} value={data.basicInformation.name}
                      onChange={(e) => update("basicInformation", { ...data.basicInformation, name: e.target.value })} />
                  </FormField>
                  <FormField label="Legal Name">
                    <input className={inputClass} value={data.basicInformation.legalName}
                      onChange={(e) => update("basicInformation", { ...data.basicInformation, legalName: e.target.value })} />
                  </FormField>
                  <FormField label="Organization Type" required>
                    <select className={selectClass} value={data.basicInformation.type}
                      onChange={(e) => update("basicInformation", { ...data.basicInformation, type: e.target.value })}>
                      {ORGANIZATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormField>
                  {data.basicInformation.type === "Other" && (
                    <FormField label="Specify Type" required>
                      <input className={inputClass} value={data.basicInformation.typeOther}
                        onChange={(e) => update("basicInformation", { ...data.basicInformation, typeOther: e.target.value })} />
                    </FormField>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Registration Number">
                      <input className={inputClass} value={data.basicInformation.registrationNumber}
                        onChange={(e) => update("basicInformation", { ...data.basicInformation, registrationNumber: e.target.value })} />
                    </FormField>
                    <FormField label="Website">
                      <input className={inputClass} value={data.basicInformation.website}
                        onChange={(e) => update("basicInformation", { ...data.basicInformation, website: e.target.value })} />
                    </FormField>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Official Email" required>
                      <input type="email" className={inputClass} value={data.basicInformation.email}
                        onChange={(e) => update("basicInformation", { ...data.basicInformation, email: e.target.value })} />
                    </FormField>
                    <FormField label="Official Phone">
                      <input className={inputClass} value={data.basicInformation.phone}
                        onChange={(e) => update("basicInformation", { ...data.basicInformation, phone: e.target.value })} />
                    </FormField>
                  </div>
                  <h3 className="pt-4 text-sm font-semibold text-muted">Location</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Country" required>
                      <input className={inputClass} value={data.location.country}
                        onChange={(e) => update("location", { ...data.location, country: e.target.value })} />
                    </FormField>
                    <FormField label="State" required>
                      <input className={inputClass} value={data.location.state}
                        onChange={(e) => update("location", { ...data.location, state: e.target.value })} />
                    </FormField>
                    <FormField label="City" required>
                      <input className={inputClass} value={data.location.city}
                        onChange={(e) => update("location", { ...data.location, city: e.target.value })} />
                    </FormField>
                    <FormField label="Postal Code">
                      <input className={inputClass} value={data.location.postalCode}
                        onChange={(e) => update("location", { ...data.location, postalCode: e.target.value })} />
                    </FormField>
                  </div>
                  <FormField label="Address">
                    <input className={inputClass} value={data.location.address}
                      onChange={(e) => update("location", { ...data.location, address: e.target.value })} />
                  </FormField>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h2 className="text-lg font-semibold">Tell us about the campus</h2>
                <div className="mt-6 space-y-4">
                  <FormField label="Campus Name" required>
                    <input className={inputClass} value={data.campus.name}
                      onChange={(e) => update("campus", { ...data.campus, name: e.target.value })} />
                  </FormField>
                  <FormField label="Campus Type" required>
                    <select className={selectClass} value={data.campus.type}
                      onChange={(e) => update("campus", { ...data.campus, type: e.target.value })}>
                      {CAMPUS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      ["buildings", "Number of Buildings"],
                      ["classrooms", "Number of Classrooms"],
                      ["laboratories", "Number of Laboratories"],
                      ["cameras", "Number of Cameras"],
                      ["students", "Number of Students"],
                      ["faculty", "Number of Faculty"],
                      ["securityPersonnel", "Security Personnel"],
                    ] as const).map(([key, label]) => (
                      <FormField key={key} label={label}>
                        <input type="number" min={0} className={inputClass}
                          value={data.campus[key]}
                          onChange={(e) => update("campus", { ...data.campus, [key]: Math.max(0, parseInt(e.target.value) || 0) })} />
                      </FormField>
                    ))}
                  </div>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="text-lg font-semibold">What will AI Campus Guardian be used for?</h2>
                <div className="mt-6 space-y-6">
                  <FormField label="Use Cases" required>
                    <CheckboxGroup options={USE_CASES} selected={data.purpose.useCases}
                      onChange={(v) => update("purpose", { ...data.purpose, useCases: v })} />
                  </FormField>
                  <FormField label="Describe your primary use case">
                    <textarea className={inputClass + " min-h-[100px]"} value={data.purpose.description}
                      onChange={(e) => update("purpose", { ...data.purpose, description: e.target.value })} />
                  </FormField>
                  <FormField label="Main safety priorities">
                    <CheckboxGroup options={SAFETY_PRIORITIES} selected={data.purpose.safetyPriorities}
                      onChange={(v) => update("purpose", { ...data.purpose, safetyPriorities: v })} />
                  </FormField>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <h2 className="text-lg font-semibold">Primary Contact</h2>
                <div className="mt-6 space-y-4">
                  <FormField label="Full Name" required>
                    <input className={inputClass} value={data.primaryContact.name}
                      onChange={(e) => update("primaryContact", { ...data.primaryContact, name: e.target.value })} />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Job Title">
                      <input className={inputClass} value={data.primaryContact.title}
                        onChange={(e) => update("primaryContact", { ...data.primaryContact, title: e.target.value })} />
                    </FormField>
                    <FormField label="Department">
                      <input className={inputClass} value={data.primaryContact.department}
                        onChange={(e) => update("primaryContact", { ...data.primaryContact, department: e.target.value })} />
                    </FormField>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Email" required>
                      <input type="email" className={inputClass} value={data.primaryContact.email}
                        onChange={(e) => update("primaryContact", { ...data.primaryContact, email: e.target.value })} />
                    </FormField>
                    <FormField label="Phone">
                      <input className={inputClass} value={data.primaryContact.phone}
                        onChange={(e) => update("primaryContact", { ...data.primaryContact, phone: e.target.value })} />
                    </FormField>
                  </div>
                  <FormField label="Preferred Contact Method">
                    <select className={selectClass} value={data.primaryContact.preferredMethod}
                      onChange={(e) => update("primaryContact", { ...data.primaryContact, preferredMethod: e.target.value as "Email" | "Phone" | "Both" })}>
                      <option value="Email">Email</option>
                      <option value="Phone">Phone</option>
                      <option value="Both">Both</option>
                    </select>
                  </FormField>
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <h2 className="text-lg font-semibold">Review & Confirm</h2>
                <div className="mt-6 space-y-4 text-sm">
                  {[
                    ["Organization", data.basicInformation.name, () => setStep(0)],
                    ["Campus", data.campus.name, () => setStep(1)],
                    ["Purpose", data.purpose.useCases.join(", ") || "—", () => setStep(2)],
                    ["Contact", data.primaryContact.name, () => setStep(3)],
                  ].map(([title, value, edit]) => (
                    <div key={title as string} className="flex items-start justify-between rounded-xl border border-border p-4">
                      <div>
                        <p className="text-muted">{title as string}</p>
                        <p className="mt-1 font-medium">{value as string}</p>
                      </div>
                      <button type="button" onClick={edit as () => void} className="text-xs text-accent">Edit</button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="mt-8 flex justify-between gap-4">
              <button type="button" disabled={step === 0 || loading}
                onClick={() => setStep((s) => s - 1)}
                className="rounded-full border border-border px-6 py-2.5 text-sm disabled:opacity-40">
                Back
              </button>
              {step < 4 ? (
                <button type="button" onClick={() => setStep((s) => s + 1)}
                  className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background">
                  Continue
                </button>
              ) : (
                <button type="button" disabled={loading} onClick={submit}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-background disabled:opacity-70">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating Organization...</> : "Create Organization"}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </SuperAdminShell>
  );
}
