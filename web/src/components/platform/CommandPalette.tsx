"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

type Result = { type: string; id: string; title: string; href: string };

const STATIC_COMMANDS: Result[] = [
  { type: "command", id: "create-incident", title: "Create Incident", href: "/admin/incidents" },
  { type: "command", id: "approvals", title: "Approvals", href: "/approvals" },
  { type: "command", id: "ai-copilot", title: "AI Copilot", href: "/ai-copilot" },
  { type: "command", id: "automation", title: "Automation", href: "/admin/automation" },
  { type: "command", id: "emergency", title: "Emergency Center", href: "/admin/emergency" },
  { type: "command", id: "campus-map", title: "Digital Campus Map", href: "/map" },
  { type: "command", id: "asset-map", title: "Asset Map", href: "/assets/map" },
  { type: "command", id: "map-analytics", title: "Map Analytics", href: "/analytics/map" },
  { type: "command", id: "video-intel", title: "Video Intelligence", href: "/video" },
  { type: "command", id: "video-wall", title: "Video Wall", href: "/command/video-wall" },
  { type: "command", id: "video-detections", title: "AI Detections", href: "/video/detections" },
  { type: "command", id: "video-evidence", title: "Video Evidence", href: "/video/evidence" },
  { type: "command", id: "video-review", title: "Detection Review", href: "/video/review" },
  { type: "command", id: "video-analytics", title: "Video Analytics", href: "/analytics/video" },
  { type: "command", id: "mobile-home", title: "Mobile Field Ops", href: "/mobile" },
  { type: "command", id: "my-tasks", title: "My Tasks", href: "/tasks" },
  { type: "command", id: "teams", title: "Response Teams", href: "/teams" },
  { type: "command", id: "field-dash", title: "Field Dashboard", href: "/field" },
  { type: "command", id: "supervisor", title: "Supervisor Dashboard", href: "/supervisor" },
  { type: "command", id: "operations", title: "Operations Dashboard", href: "/operations" },
  { type: "command", id: "executive-cmd", title: "Executive Command", href: "/executive" },
  { type: "command", id: "governance", title: "Governance Center", href: "/governance" },
  { type: "command", id: "strategy", title: "Strategic Initiatives", href: "/strategy" },
  { type: "command", id: "exec-reports", title: "Executive Reports", href: "/reports/executive" },
  { type: "command", id: "patrol", title: "Patrol", href: "/patrol" },
  { type: "command", id: "inspections", title: "Inspections", href: "/inspections" },
  { type: "command", id: "communication", title: "Communication", href: "/communication" },
];

function isAdminSurface(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/enterprise") ||
    pathname.startsWith("/approvals") ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/team") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/operations") ||
    pathname.startsWith("/ai") ||
    pathname.startsWith("/ai-copilot") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/map") ||
    pathname.startsWith("/campus") ||
    pathname.startsWith("/building") ||
    pathname.startsWith("/floor") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/emergency") ||
    pathname.startsWith("/analytics")
  );
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);

  const showAdminCommands = isAdminSurface(pathname);

  const staticMatches = useMemo(() => {
    if (!showAdminCommands) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return STATIC_COMMANDS;
    return STATIC_COMMANDS.filter((c) => c.title.toLowerCase().includes(needle));
  }, [q, showAdminCommands]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (!res.ok) return;
      const j = await res.json();
      setResults(j.results ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQ("");
      router.push(href);
    },
    [router]
  );

  if (!open) return null;

  const combined = [
    ...staticMatches,
    ...results.filter((r) => !staticMatches.some((s) => s.href === r.href && s.title === r.title)),
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            autoFocus
            className="w-full bg-transparent py-3 text-sm outline-none"
            placeholder="Search or run a command… (⌘K)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {combined.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <button
                type="button"
                onClick={() => go(r.href)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <span>{r.title}</span>
                <span className="text-xs uppercase text-muted">{r.type}</span>
              </button>
            </li>
          ))}
          {q.length >= 2 && combined.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted">No results</li>
          )}
          {q.length < 2 && !showAdminCommands && (
            <li className="px-3 py-6 text-center text-sm text-muted">Type at least 2 characters</li>
          )}
          {q.length < 2 && showAdminCommands && staticMatches.length > 0 && combined.length === 0 ? null : null}
        </ul>
      </div>
    </div>
  );
}
