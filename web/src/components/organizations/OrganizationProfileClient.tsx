"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { StatusBadge } from "@/components/super-admin/StatusBadge";
import { EmptyState } from "@/components/super-admin/EmptyState";
import { formatRelativeTime } from "@/lib/utils/time";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { cn } from "@/lib/utils";
import { ORGANIZATION_TYPES, CAMPUS_TYPES } from "@/lib/organizations/constants";

const TABS = [
  "Overview",
  "Organization Information",
  "Campus",
  "Purpose & Safety",
  "Administrators",
  "Users",
  "Activity",
  "Settings",
] as const;

type Tab = (typeof TABS)[number];

interface OrgDetail {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  location: string;
  city: string;
  country: string;
  admins: number;
  staff: number;
  cameras: number;
  status: string;
  createdAt: string;
  lastActivity: string;
  basicInformation: Record<string, string>;
  locationDetails: Record<string, string>;
  campus: Record<string, string | number>;
  purpose: { useCases: string[]; description: string; safetyPriorities: string[] };
  primaryContact: Record<string, string>;
}

interface AdminRow {
  id: string;
  name: string;
  userId: string;
  email: string;
  status: string;
  jobTitle: string;
  department: string;
  lastLogin: string | null;
  createdAt: string;
}

interface OrgUserRow {
  id: string;
  name: string;
  userId: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string | null;
  isOnline: boolean;
  createdAt: string;
}

interface ActivityRow {
  id: string;
  action: string;
  description: string;
  actorName: string;
  actorRole: string;
  severity: string;
  targetType: string | null;
  targetLabel: string | null;
  createdAt: string;
}

export function OrganizationProfileClient({ user, orgId }: { user: SafeUser; orgId: string }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (
    tabParam === "settings"
      ? "Settings"
      : tabParam === "users"
        ? "Users"
        : tabParam === "activity"
          ? "Activity"
          : "Overview"
  ) as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminQ, setAdminQ] = useState("");

  const [users, setUsers] = useState<OrgUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userQ, setUserQ] = useState("");
  const [userRole, setUserRole] = useState("ALL");
  const [userStatus, setUserStatus] = useState("ALL");

  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    legalName: "",
    type: "University",
    email: "",
    phone: "",
    website: "",
    country: "",
    state: "",
    city: "",
    address: "",
    postalCode: "",
    campusName: "",
    campusType: "Main Campus",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactTitle: "",
  });

  const fetchOrg = useCallback(async () => {
    const res = await fetch(`/api/super-admin/organizations/${orgId}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      const o = data.organization as OrgDetail;
      setOrg(o);
      setSettingsForm({
        name: o.basicInformation.name || "",
        legalName: o.basicInformation.legalName || "",
        type: o.basicInformation.type || "University",
        email: o.basicInformation.email || "",
        phone: o.basicInformation.phone || "",
        website: o.basicInformation.website || "",
        country: o.locationDetails.country || "",
        state: o.locationDetails.state || "",
        city: o.locationDetails.city || "",
        address: o.locationDetails.address || "",
        postalCode: o.locationDetails.postalCode || "",
        campusName: String(o.campus.name || ""),
        campusType: String(o.campus.type || "Main Campus"),
        contactName: o.primaryContact.name || "",
        contactEmail: o.primaryContact.email || "",
        contactPhone: o.primaryContact.phone || "",
        contactTitle: o.primaryContact.title || "",
      });
    }
  }, [orgId]);

  const fetchAdmins = useCallback(async () => {
    const params = adminQ ? `?q=${encodeURIComponent(adminQ)}` : "";
    const res = await fetch(`/api/super-admin/organizations/${orgId}/admins${params}`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      setAdmins(data.admins);
    }
  }, [orgId, adminQ]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({
        organizationId: orgId,
        q: userQ,
        role: userRole,
        status: userStatus,
        limit: "50",
      });
      const res = await fetch(`/api/super-admin/users?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } finally {
      setUsersLoading(false);
    }
  }, [orgId, userQ, userRole, userStatus]);

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/activity`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setActivity(data.activity ?? []);
      }
    } finally {
      setActivityLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchOrg(), fetchAdmins()]);
      setLoading(false);
    })();
  }, [fetchOrg, fetchAdmins]);

  useEffect(() => {
    if (tab === "Users") {
      const t = setTimeout(fetchUsers, 250);
      return () => clearTimeout(t);
    }
  }, [tab, fetchUsers]);

  useEffect(() => {
    if (tab === "Activity") fetchActivity();
  }, [tab, fetchActivity]);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSaved(false);
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basicInformation: {
            name: settingsForm.name,
            legalName: settingsForm.legalName,
            type: settingsForm.type,
            email: settingsForm.email,
            phone: settingsForm.phone,
            website: settingsForm.website,
            registrationNumber: org.basicInformation.registrationNumber || "",
            logo: org.basicInformation.logo || "",
            typeOther: org.basicInformation.typeOther || "",
          },
          location: {
            country: settingsForm.country,
            state: settingsForm.state,
            city: settingsForm.city,
            address: settingsForm.address,
            postalCode: settingsForm.postalCode,
          },
          campus: {
            name: settingsForm.campusName,
            type: settingsForm.campusType,
            buildings: Number(org.campus.buildings) || 0,
            classrooms: Number(org.campus.classrooms) || 0,
            laboratories: Number(org.campus.laboratories) || 0,
            cameras: Number(org.campus.cameras) || 0,
            students: Number(org.campus.students) || 0,
            faculty: Number(org.campus.faculty) || 0,
            securityPersonnel: Number(org.campus.securityPersonnel) || 0,
          },
          purpose: org.purpose,
          primaryContact: {
            name: settingsForm.contactName,
            title: settingsForm.contactTitle,
            department: org.primaryContact.department || "",
            email: settingsForm.contactEmail,
            phone: settingsForm.contactPhone,
            preferredMethod: (org.primaryContact.preferredMethod as "Email" | "Phone" | "Both") || "Email",
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setOrg(json.organization);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function changeStatus(status: "ACTIVE" | "SUSPENDED" | "INACTIVE") {
    setStatusBusy(true);
    setSettingsError(null);
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Status update failed");
      setOrg(json.organization);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setStatusBusy(false);
    }
  }

  async function archiveOrg() {
    if (!org || confirmDelete.trim() !== org.name) {
      setSettingsError("Type the exact organization name to confirm archive.");
      return;
    }
    setStatusBusy(true);
    setSettingsError(null);
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: confirmDelete.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Archive failed");
      window.location.assign("/super-admin/organizations");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Archive failed");
      setStatusBusy(false);
    }
  }

  async function userStatusAction(userId: string, action: "activate" | "suspend" | "unlock") {
    await fetch(`/api/super-admin/users/${userId}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await fetchUsers();
  }

  if (loading) {
    return (
      <SuperAdminShell user={user}>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </SuperAdminShell>
    );
  }

  if (!org) {
    return (
      <SuperAdminShell user={user}>
        <EmptyState
          icon="building"
          title="Organization not found"
          description="This organization may have been archived."
        />
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell user={user}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/super-admin/organizations" className="text-sm text-muted hover:text-accent">
            ← Organizations
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{org.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono text-accent">{org.organizationId}</span>
            <span className="text-muted">{org.type}</span>
            <span className="text-muted">{org.location}</span>
            <StatusBadge status={org.status} />
            <span className="text-muted">Created {formatRelativeTime(new Date(org.createdAt))}</span>
          </div>
        </div>
        <Link
          href={`/super-admin/organizations/${orgId}/admins/new`}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" /> Create Admin
        </Link>
      </div>

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap px-4 py-2.5 text-sm transition-colors",
              tab === t ? "border-b-2 border-accent text-accent" : "text-muted hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        {tab === "Overview" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Administrators", org.admins],
              ["Staff", org.staff],
              ["Cameras", org.cameras],
              ["Buildings", org.campus.buildings],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-border bg-surface/60 p-5">
                <p className="text-xs uppercase tracking-wider text-muted">{label as string}</p>
                <p className="mt-2 font-mono text-2xl font-semibold">{value as number}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-border bg-surface/60 p-5 sm:col-span-2">
              <p className="text-xs uppercase tracking-wider text-muted">Primary Contact</p>
              <p className="mt-2 font-medium">{org.primaryContact.name}</p>
              <p className="text-sm text-muted">{org.primaryContact.email}</p>
            </div>
          </div>
        )}

        {tab === "Organization Information" && (
          <InfoGrid
            items={[
              ["Name", org.basicInformation.name],
              ["Legal Name", org.basicInformation.legalName],
              ["Type", org.type],
              ["Registration", org.basicInformation.registrationNumber],
              ["Website", org.basicInformation.website],
              ["Email", org.basicInformation.email],
              ["Phone", org.basicInformation.phone],
              ["Country", org.locationDetails.country],
              ["State", org.locationDetails.state],
              ["City", org.locationDetails.city],
              ["Address", org.locationDetails.address],
              ["Postal Code", org.locationDetails.postalCode],
            ]}
          />
        )}

        {tab === "Campus" && (
          <InfoGrid
            items={Object.entries(org.campus).map(([k, v]) => [
              k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
              String(v),
            ])}
          />
        )}

        {tab === "Purpose & Safety" && (
          <div className="space-y-6">
            <Section title="Use Cases" items={org.purpose.useCases} />
            <div className="rounded-2xl border border-border p-5">
              <p className="text-xs uppercase tracking-wider text-muted">Primary Use Case</p>
              <p className="mt-2 text-sm">{org.purpose.description || "—"}</p>
            </div>
            <Section title="Safety Priorities" items={org.purpose.safetyPriorities} />
          </div>
        )}

        {tab === "Administrators" && (
          <div>
            <div className="relative mb-4 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={adminQ}
                onChange={(e) => setAdminQ(e.target.value)}
                placeholder="Search admins..."
                className="w-full rounded-xl border border-border bg-glass py-2.5 pl-10 pr-4 text-sm"
              />
            </div>
            {admins.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No administrators yet"
                description="Create the first administrator for this organization."
                actionLabel="Create Admin"
                onAction={() =>
                  window.location.assign(`/super-admin/organizations/${orgId}/admins/new`)
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted">
                      <th className="px-4 py-3">Admin Name</th>
                      <th className="px-4 py-3">Admin ID</th>
                      <th className="px-4 py-3">Position</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Login</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((a) => (
                      <tr key={a.id} className="border-b border-border/60">
                        <td className="px-4 py-3 font-medium">{a.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{a.userId}</td>
                        <td className="px-4 py-3">{a.jobTitle}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {a.lastLogin ? formatRelativeTime(new Date(a.lastLogin)) : "Never"}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatRelativeTime(new Date(a.createdAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "Users" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={userQ}
                  onChange={(e) => setUserQ(e.target.value)}
                  placeholder="Search users in this organization..."
                  className="w-full rounded-xl border border-border bg-glass py-2.5 pl-10 pr-4 text-sm"
                />
              </div>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="rounded-xl border border-border bg-glass px-3 py-2.5 text-sm"
              >
                <option value="ALL">All roles</option>
                <option value="ADMIN">Admin</option>
                <option value="STAFF">Staff</option>
              </select>
              <select
                value={userStatus}
                onChange={(e) => setUserStatus(e.target.value)}
                className="rounded-xl border border-border bg-glass px-3 py-2.5 text-sm"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="LOCKED">Locked</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <button
                type="button"
                onClick={fetchUsers}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm text-muted hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-accent" />
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No users found"
                description="No users match these filters for this organization."
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">User ID</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last login</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border/60">
                        <td className="px-4 py-3">
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{u.userId}</td>
                        <td className="px-4 py-3">{u.role}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={u.status} />
                            {u.isOnline && (
                              <span className="h-2 w-2 rounded-full bg-emerald-400" title="Online" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {u.lastLogin ? formatRelativeTime(new Date(u.lastLogin)) : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {u.status !== "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => userStatusAction(u.id, "activate")}
                                className="text-xs text-accent hover:underline"
                              >
                                Activate
                              </button>
                            )}
                            {u.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => userStatusAction(u.id, "suspend")}
                                className="text-xs text-amber-400 hover:underline"
                              >
                                Suspend
                              </button>
                            )}
                            {u.status === "LOCKED" && (
                              <button
                                type="button"
                                onClick={() => userStatusAction(u.id, "unlock")}
                                className="text-xs text-accent hover:underline"
                              >
                                Unlock
                              </button>
                            )}
                            <Link
                              href={`/super-admin/users?q=${encodeURIComponent(u.userId)}`}
                              className="text-xs text-muted hover:text-foreground"
                            >
                              Open
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "Activity" && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Recent audited actions for this organization and its members.
              </p>
              <button
                type="button"
                onClick={fetchActivity}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
            {activityLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-accent" />
              </div>
            ) : activity.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No activity yet"
                description="Audit events for this organization will appear here."
              />
            ) : (
              <ul className="space-y-2">
                {activity.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-2xl border border-border bg-surface/50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{a.description}</p>
                        <p className="mt-1 text-xs text-muted">
                          <span className="font-mono text-accent/90">{a.action}</span>
                          {" · "}
                          {a.actorName} ({a.actorRole})
                          {a.targetLabel ? ` · ${a.targetLabel}` : ""}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted">
                        <div className="capitalize">{a.severity}</div>
                        <div>{formatRelativeTime(new Date(a.createdAt))}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "Settings" && (
          <div className="space-y-8">
            {settingsError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {settingsError}
              </div>
            )}

            <form
              onSubmit={saveSettings}
              className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide">Edit organization</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["name", "Organization name"],
                    ["legalName", "Legal name"],
                    ["email", "Official email"],
                    ["phone", "Phone"],
                    ["website", "Website"],
                    ["country", "Country"],
                    ["state", "State"],
                    ["city", "City"],
                    ["address", "Address"],
                    ["postalCode", "Postal code"],
                    ["campusName", "Campus name"],
                    ["contactName", "Primary contact name"],
                    ["contactTitle", "Contact title"],
                    ["contactEmail", "Contact email"],
                    ["contactPhone", "Contact phone"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    <span className="text-muted">{label}</span>
                    <input
                      className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5 outline-none focus:border-accent/40"
                      value={settingsForm[key]}
                      onChange={(e) =>
                        setSettingsForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                      required={key === "name" || key === "email" || key === "country" || key === "state" || key === "city" || key === "campusName" || key === "contactName" || key === "contactEmail"}
                    />
                  </label>
                ))}
                <label className="block text-sm">
                  <span className="text-muted">Organization type</span>
                  <select
                    className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5"
                    value={settingsForm.type}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    {ORGANIZATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-muted">Campus type</span>
                  <select
                    className="mt-1.5 w-full rounded-xl border border-border bg-glass px-3 py-2.5"
                    value={settingsForm.campusType}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, campusType: e.target.value }))}
                  >
                    {CAMPUS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
                >
                  {settingsSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save changes
                </button>
                {settingsSaved && <span className="text-sm text-emerald-400">Saved</span>}
              </div>
            </form>

            <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Status actions</h2>
              <p className="mt-1 text-sm text-muted">
                Current status: <StatusBadge status={org.status} />
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {org.status !== "ACTIVE" && (
                  <button
                    type="button"
                    disabled={statusBusy}
                    onClick={() => changeStatus("ACTIVE")}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 disabled:opacity-50"
                  >
                    Activate
                  </button>
                )}
                {org.status !== "SUSPENDED" && (
                  <button
                    type="button"
                    disabled={statusBusy}
                    onClick={() => changeStatus("SUSPENDED")}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                )}
                {org.status !== "INACTIVE" && (
                  <button
                    type="button"
                    disabled={statusBusy}
                    onClick={() => changeStatus("INACTIVE")}
                    className="rounded-xl border border-border px-4 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
                  >
                    Mark inactive
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 sm:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-300">
                Archive organization
              </h2>
              <p className="mt-1 text-sm text-muted">
                Soft-deletes the organization. Type <strong>{org.name}</strong> to confirm.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  value={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.value)}
                  placeholder="Organization name"
                  className="min-w-[220px] flex-1 rounded-xl border border-border bg-glass px-3 py-2.5 text-sm"
                />
                <button
                  type="button"
                  disabled={statusBusy || confirmDelete.trim() !== org.name}
                  onClick={archiveOrg}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Archive
                </button>
              </div>
            </section>
          </div>
        )}
      </motion.div>
    </SuperAdminShell>
  );
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border p-4">
          <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
          <p className="mt-1 text-sm">{value || "—"}</p>
        </div>
      ))}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length ? (
          items.map((i) => (
            <span
              key={i}
              className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs"
            >
              {i}
            </span>
          ))
        ) : (
          <span className="text-sm text-muted">—</span>
        )}
      </div>
    </div>
  );
}
