"use client";

import { useCallback, useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";

export function EmergencyContactsClient({ user }: { user: SafeUser }) {
  const [contacts, setContacts] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ name: "", department: "", role: "", phone: "", email: "" });

  const load = useCallback(() => {
    fetch("/api/emergency-contacts", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts ?? []));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!form.name.trim()) return;
    await fetch("/api/emergency-contacts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", department: "", role: "", phone: "", email: "" });
    load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Emergency Contacts</h1>
      <p className="mt-1 text-muted">Organization-approved contact directory. Does not auto-call emergency services.</p>

      <div className="mt-6 grid gap-2 rounded-xl border border-border p-4 sm:grid-cols-3">
        {(["name", "department", "role", "phone", "email"] as const).map((k) => (
          <input
            key={k}
            value={form[k]}
            onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
            placeholder={k}
            className="rounded-lg border border-border bg-black/20 px-3 py-2 text-sm"
          />
        ))}
        <button type="button" onClick={create} className="rounded-lg bg-accent/20 px-4 py-2 text-sm text-accent">Add Contact</button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Priority</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={String(c.id)} className="border-b border-white/[0.04]">
                <td className="px-4 py-3">{String(c.name)}</td>
                <td className="px-4 py-3">{String(c.department)}</td>
                <td className="px-4 py-3">{String(c.role)}</td>
                <td className="px-4 py-3">{String(c.phone)}</td>
                <td className="px-4 py-3">{String(c.email)}</td>
                <td className="px-4 py-3">{String(c.priority)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
