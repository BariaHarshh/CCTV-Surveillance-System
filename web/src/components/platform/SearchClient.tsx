"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { SafeUser } from "@/lib/auth/sanitize-user";

type Result = { type: string; id: string; title: string; href: string };

export function SearchClient({ user, initialQ = "" }: { user: SafeUser; initialQ?: string }) {
  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const j = await res.json();
      setResults(j.results ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <AdminShell user={user}>
      <h1 className="text-2xl font-bold">Search</h1>
      <p className="mt-1 text-muted">Find cameras, incidents, alerts, and users in your organization</p>
      <div className="relative mt-6 max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          className="w-full rounded-2xl border border-border bg-surface/50 py-3 pl-10 pr-4"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ul className="mt-6 max-w-xl space-y-2">
        {loading && <li className="text-sm text-muted">Searching…</li>}
        {results.map((r) => (
          <li key={`${r.type}-${r.id}`}>
            <Link
              href={r.href}
              className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-3 hover:border-accent/40"
            >
              <span>{r.title}</span>
              <span className="text-xs uppercase text-muted">{r.type}</span>
            </Link>
          </li>
        ))}
        {!loading && q.length >= 2 && results.length === 0 && (
          <li className="text-sm text-muted">No matches.</li>
        )}
      </ul>
    </AdminShell>
  );
}
