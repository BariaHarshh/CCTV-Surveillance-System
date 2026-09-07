"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Department = {
  id: string;
  departmentId: string;
  name: string;
  description: string;
};

export function DepartmentsClient({ user }: { user: SafeUser }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/departments", { credentials: "include" });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Failed to load departments.");
      setLoading(false);
      return;
    }
    setDepartments(j.departments ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/departments", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(j.error ?? "Failed to create department.");
      return;
    }
    setName("");
    setDescription("");
    await load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Departments</h1>
      <p className="mt-1 text-sm text-muted">Organize staff and invitations by department</p>

      <form onSubmit={create} className="mt-8 rounded-2xl border border-border bg-surface/50 p-6">
        <h2 className="font-semibold">Add department</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
              placeholder="Campus Security"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
              placeholder="Optional"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create department"}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </form>

      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <div className="mt-6 space-y-3">
          {departments.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border bg-surface/40 p-4">
              <div className="font-mono text-xs text-muted">{d.departmentId}</div>
              <div className="mt-1 font-semibold">{d.name}</div>
              {d.description && <p className="mt-1 text-sm text-muted">{d.description}</p>}
            </div>
          ))}
          {departments.length === 0 && <p className="text-sm text-muted">No departments yet.</p>}
        </div>
      )}
    </AdminShell>
  );
}
