"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type KeyRow = {
  id: string;
  keyId: string;
  name: string;
  prefix: string;
  permissions: string[];
  createdAt: string;
  createdByName: string;
};

export function ApiKeysClient({ user }: { user: SafeUser }) {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [createdSecret, setCreatedSecret] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/settings/api-keys", { credentials: "include" });
    const j = await res.json();
    setKeys(j.keys ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError("");
    setCreatedSecret("");
    const res = await fetch("/api/settings/api-keys", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Failed to create key.");
      return;
    }
    setCreatedSecret(j.key.secret);
    setName("");
    await load();
  }

  async function revoke(id: string) {
    await fetch(`/api/settings/api-keys?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
  }

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">API keys</h1>
      <p className="mt-1 text-muted">Create and revoke organization API keys</p>

      <section className="mt-8 rounded-2xl border border-border bg-surface/50 p-6">
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            placeholder="Key name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            onClick={create}
            disabled={!name.trim()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            Create key
          </button>
        </div>
        {createdSecret && (
          <p className="mt-4 break-all rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 font-mono text-sm text-amber-100">
            Copy now — shown once: {createdSecret}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {loading ? (
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-accent" />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Prefix</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-white/[0.04]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{k.name}</div>
                    <div className="font-mono text-xs text-muted">{k.keyId}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{k.prefix}…</td>
                  <td className="px-4 py-3 text-muted">{new Date(k.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => revoke(k.id)}
                      className="inline-flex items-center gap-1 text-red-300 hover:text-red-200"
                    >
                      <Trash2 className="h-4 w-4" /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No API keys yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
