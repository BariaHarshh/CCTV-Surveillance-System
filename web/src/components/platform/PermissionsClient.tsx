"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

const PERMISSION_GROUPS: { title: string; permissions: string[] }[] = [
  {
    title: "Campus & Infrastructure",
    permissions: [
      "campus.view",
      "campus.edit",
      "building.view",
      "building.create",
      "building.edit",
      "room.view",
      "room.create",
      "room.edit",
      "camera.view",
      "camera.create",
      "camera.edit",
      "camera.test",
      "camera.delete",
    ],
  },
  {
    title: "Monitoring & Alerts",
    permissions: [
      "monitoring.view",
      "event.view",
      "alert.view",
      "alert.acknowledge",
      "alert.investigate",
      "alert.resolve",
      "alert.dismiss",
    ],
  },
  {
    title: "AI & Incidents",
    permissions: [
      "ai.view",
      "ai.configure",
      "detection.view",
      "detection.configure",
      "camera.ai.configure",
      "incident.view",
      "incident.manage",
      "incident.assign",
      "incident.escalate",
      "risk.view",
    ],
  },
  {
    title: "Emergency Response",
    permissions: [
      "emergency.view",
      "emergency.activate",
      "emergency.manage",
      "emergency.resolve",
      "response_team.view",
      "response_team.manage",
      "playbook.view",
      "playbook.manage",
      "command_center.view",
    ],
  },
  {
    title: "Analytics & Reports",
    permissions: [
      "analytics.view",
      "analytics.export",
      "reports.view",
      "reports.generate",
      "executive.view",
      "actions.view",
      "actions.manage",
      "insights.view",
    ],
  },
];

const ROLES = ["ADMIN", "STAFF"] as const;

/** Read-only matrix — ADMIN inherits broad org permissions; STAFF uses explicit grants. */
function roleHas(permission: string, role: (typeof ROLES)[number]): boolean {
  if (role === "ADMIN") return true;
  const staffDefaults = new Set([
    "campus.view",
    "building.view",
    "room.view",
    "camera.view",
    "monitoring.view",
    "event.view",
    "alert.view",
    "incident.view",
    "emergency.view",
    "analytics.view",
    "reports.view",
  ]);
  return staffDefaults.has(permission);
}

export function PermissionsClient({ user }: { user: SafeUser }) {
  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Permissions</h1>
      <p className="mt-1 text-sm text-muted">
        Capability matrix for organization roles. Custom roles can be extended in a future release.
      </p>

      <div className="mt-8 space-y-8">
        {PERMISSION_GROUPS.map((group) => (
          <section key={group.title} className="overflow-hidden rounded-2xl border border-border">
            <h2 className="border-b border-border bg-surface/50 px-4 py-3 text-sm font-semibold">{group.title}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Permission</th>
                    {ROLES.map((r) => (
                      <th key={r} className="px-4 py-3 text-center">
                        {r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.permissions.map((perm) => (
                    <tr key={perm} className="border-b border-white/[0.04]">
                      <td className="px-4 py-2.5 font-mono text-xs">{perm}</td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-4 py-2.5 text-center">
                          {roleHas(perm, role) ? (
                            <span className="text-accent">✓</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted">
        Signed in as {user.role}. Staff members receive explicit permission grants on invitation or profile update.
      </p>
    </AdminShell>
  );
}
