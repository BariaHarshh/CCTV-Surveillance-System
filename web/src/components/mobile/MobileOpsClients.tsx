"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { MobileShell } from "@/components/mobile/MobileShell";

export function TasksClient({ user, taskId }: { user: SafeUser; taskId?: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const url = taskId
      ? `/api/mobile/tasks/${taskId}/actions`
      : `/api/mobile/tasks${filter !== "ALL" ? `?status=${filter}` : ""}`;
    const res = await fetch(url, { credentials: "include" });
    const json = await res.json();
    setData(json);
  }, [taskId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!taskId) return;
    if (["complete", "reject"].includes(action) && !window.confirm(`Confirm ${action}?`)) return;
    const res = await fetch(`/api/mobile/tasks/${taskId}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, confirmed: true, ...extra }),
    });
    const json = await res.json();
    setMsg(res.ok ? `OK: ${action}` : json.error || "Failed");
    load();
  };

  if (taskId) {
    const t = (data?.task as Record<string, unknown>) || {};
    return (
      <MobileShell user={user} title="Task">
        <h2 className="text-xl font-semibold">{String(t.title || "…")}</h2>
        <p className="mt-1 text-sm text-white/60">{String(t.description || "")}</p>
        <p className="mt-2 text-xs text-muted">
          {String(t.status)} · {String(t.priority)} · {String(t.locationLabel || "No location")}
        </p>
        {Boolean(t.demo) && <p className="text-xs text-amber-300">DEMO DATA</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {["start", "pause", "complete", "reject"].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => act(a)}
              className="min-h-11 rounded-xl border border-white/15 px-3 text-xs capitalize"
            >
              {a}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const note = window.prompt("Note");
              if (note) act("note", { note });
            }}
            className="min-h-11 rounded-xl border border-white/15 px-3 text-xs"
          >
            Add Note
          </button>
          <button
            type="button"
            onClick={() => act("attach", { type: "NOTE", name: "Field note", ref: `note_${Date.now()}` })}
            className="min-h-11 rounded-xl border border-white/15 px-3 text-xs"
          >
            Add Proof
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-sky-300">{msg}</p>}

        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-muted">Checklist</h3>
          <ul className="mt-2 space-y-2">
            {((t.checklist as Array<Record<string, unknown>>) || []).map((c) => (
              <li key={String(c.key)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(c.done)}
                    onChange={(e) => act("checklist", { key: c.key, done: e.target.checked })}
                  />
                  {String(c.label)}
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-muted">Timeline</h3>
          <ul className="mt-2 space-y-1 text-xs text-foreground/70">
            {((t.timeline as Array<Record<string, unknown>>) || []).map((e, i) => (
              <li key={i}>
                {e.at ? new Date(String(e.at)).toLocaleString() : ""} · {String(e.action)} ·{" "}
                {String(e.userName)}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-muted">Attachments</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {((t.attachments as Array<Record<string, unknown>>) || []).map((a, i) => (
              <li key={i}>
                {String(a.type)} · {String(a.name)} · unverified proof
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 flex gap-3 text-xs">
          {typeof (t.links as { map?: string } | undefined)?.map === "string" ? (
            <Link href={String((t.links as { map: string }).map)} className="text-sky-400">
              Open Map
            </Link>
          ) : null}
          {typeof (t.links as { video?: string } | undefined)?.video === "string" ? (
            <Link href={String((t.links as { video: string }).video)} className="text-sky-400">
              Nearby Cameras
            </Link>
          ) : null}
        </div>
      </MobileShell>
    );
  }

  const buckets = (data?.buckets as Record<string, number>) || {};
  const tasks = (data?.tasks as Array<Record<string, unknown>>) || [];

  return (
    <MobileShell user={user} title="Tasks">
      <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
        {[
          ["Assigned", buckets.assigned],
          ["Active", buckets.inProgress],
          ["Overdue", buckets.overdue],
          ["Done", buckets.completed],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-border p-2">
            <p className="text-sm font-semibold">{v ?? 0}</p>
            <p className="text-muted">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {["ALL", "PENDING", "IN_PROGRESS", "OVERDUE", "COMPLETED"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-10 rounded-lg border px-2 text-[10px] ${
              filter === f ? "border-sky-400 text-sky-200" : "border-border text-white/60"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {tasks.map((t) => (
          <li key={String(t.id)}>
            <Link href={`/tasks/${t.id}`} className="block rounded-xl border border-border p-3 text-sm">
              <p className="font-medium">{String(t.title)}</p>
              <p className="text-xs text-muted">
                {String(t.status)} · {String(t.priority)}
                {t.overdue ? " · Overdue" : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </MobileShell>
  );
}

export function TeamsClient({ user, teamId }: { user: SafeUser; teamId?: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const url = teamId ? `/api/mobile/teams?id=${teamId}` : "/api/mobile/teams";
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then(setData);
  }, [teamId]);

  if (teamId) {
    const team = (data?.team as Record<string, unknown>) || {};
    return (
      <MobileShell user={user} title="Team">
        <h2 className="text-xl font-semibold">{String(team.name || "…")}</h2>
        <p className="text-sm text-white/60">
          {String(team.status)} · {String(team.currentAssignment || "No assignment")}
        </p>
        <h3 className="mt-4 text-xs uppercase text-muted">Members</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {((team.members as Array<Record<string, unknown>>) || []).map((m) => (
            <li key={String(m.userId)}>
              {String(m.name)} · {String(m.role)}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-xs uppercase text-muted">Tasks</h3>
        <ul className="mt-2 space-y-2">
          {((data?.tasks as Array<Record<string, unknown>>) || []).map((t) => (
            <li key={String(t.id)}>
              <Link href={`/tasks/${t.id}`} className="text-sky-300">
                {String(t.title)}
              </Link>
            </li>
          ))}
        </ul>
      </MobileShell>
    );
  }

  const teams = (data?.teams as Array<Record<string, unknown>>) || [];
  return (
    <MobileShell user={user} title="Teams">
      <ul className="space-y-2">
        {teams.map((t) => (
          <li key={String(t.id)}>
            <Link href={`/teams/${t.id}`} className="block rounded-xl border border-border p-3">
              <p className="font-medium">{String(t.name)}</p>
              <p className="text-xs text-muted">
                {String(t.status)} · {String(t.memberCount)} members
                {t.supervisor ? ` · Sup: ${String(t.supervisor)}` : ""}
              </p>
              {t.location ? (
                <p className="text-[10px] text-white/40">
                  Location {Boolean((t.location as { live?: boolean }).live) ? "(live configured)" : "(configured, not live GPS)"}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/api/mobile/teams?recommend=1" className="mt-4 inline-block text-xs text-sky-400">
        View assignment recommendations (API)
      </Link>
    </MobileShell>
  );
}

export function OpsDashClient({
  user,
  view,
}: {
  user: SafeUser;
  view: "field" | "supervisor" | "operations" | "patrol" | "inspections" | "directory" | "announcements" | "communication" | "analytics" | "emergency" | "profile";
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (view === "announcements" || view === "communication") {
      fetch("/api/mobile/communication", { credentials: "include" })
        .then((r) => r.json())
        .then(setData);
      return;
    }
    if (view === "emergency") {
      fetch("/api/mobile/me", { credentials: "include" })
        .then((r) => r.json())
        .then(setData);
      return;
    }
    if (view === "profile") {
      fetch("/api/mobile/me", { credentials: "include" })
        .then((r) => r.json())
        .then(setData);
      return;
    }
    const map: Record<string, string> = {
      field: "field",
      supervisor: "supervisor",
      operations: "operations",
      patrol: "patrol",
      inspections: "inspections",
      directory: "directory",
      analytics: "analytics",
    };
    fetch(`/api/mobile/ops?view=${map[view] || "field"}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData);
  }, [view]);

  const checkIn = async (status: string) => {
    await fetch("/api/mobile/checkins", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, emergencyId: (data?.emergency as { id?: string })?.id }),
    });
    alert("Check-in submitted");
  };

  return (
    <MobileShell
      user={user}
      title={view.charAt(0).toUpperCase() + view.slice(1)}
      emergencyActive={Boolean(data?.emergency || data?.summary && (data.summary as { emergencyActive?: boolean }).emergencyActive)}
    >
      {view === "emergency" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-500/40 bg-red-600/20 p-4">
            <p className="text-lg font-bold text-red-100">EMERGENCY MODE</p>
            {data?.emergency ? (
              <p className="mt-1 text-sm">
                {String((data.emergency as { title?: string }).title)} ·{" "}
                {String((data.emergency as { severity?: string }).severity)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-foreground/70">No active emergency in system data.</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[
              ["I AM SAFE", "I_AM_SAFE"],
              ["I NEED ASSISTANCE", "I_NEED_ASSISTANCE"],
              ["ON SCENE", "ON_SCENE"],
            ].map(([label, status]) => (
              <button
                key={status}
                type="button"
                onClick={() => checkIn(status)}
                className="min-h-12 rounded-xl border border-white/20 text-sm font-semibold"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted">
            Safety status is only shown from submitted check-ins — never inferred.
          </p>
          <Link href="/map?mode=EMERGENCY" className="text-sm text-sky-300">
            Emergency map / exits
          </Link>
        </div>
      )}

      {view === "profile" && (
        <div className="space-y-3 text-sm">
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-white/60">{user.role}</p>
          <p>Status: {String(data?.myStatus || "—")}</p>
          <Link href="/settings/sessions" className="block text-sky-300">
            Active sessions / revoke
          </Link>
          <Link href="/settings/notifications" className="block text-sky-300">
            Notification preferences
          </Link>
          <p className="text-[11px] text-white/40">
            Location sharing: {data?.locationSharingEnabled ? "ON — collection active" : "OFF"}
          </p>
        </div>
      )}

      {(view === "field" || view === "supervisor" || view === "operations" || view === "analytics") && (
        <pre className="overflow-auto rounded-xl border border-border p-3 text-[10px] text-foreground/70">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}

      {view === "patrol" && (
        <div className="space-y-2 text-sm">
          {((data?.runs as Array<Record<string, unknown>>) || []).map((p) => (
            <div key={String(p.patrolId)} className="rounded-xl border border-border p-3">
              {String(p.routeName)} · {String(p.status)}
              {p.demo ? " · DEMO DATA" : ""}
            </div>
          ))}
          {!data?.runs && <p className="text-muted">No patrols. Create routes via ops API.</p>}
        </div>
      )}

      {view === "inspections" && (
        <div className="space-y-2 text-sm">
          {((data?.inspections as Array<Record<string, unknown>>) || []).map((i) => (
            <div key={String(i.inspectionId)} className="rounded-xl border border-border p-3">
              {String(i.title)} · {String(i.status)} · {String(i.result || "—")}
            </div>
          ))}
        </div>
      )}

      {view === "directory" && (
        <ul className="space-y-2 text-sm">
          {((data?.directory as Array<Record<string, unknown>>) || []).map((d) => (
            <li key={String(d.id)} className="rounded-xl border border-border p-3">
              {String(d.name)} · {String(d.role)} · {String(d.availability)}
            </li>
          ))}
        </ul>
      )}

      {(view === "announcements" || view === "communication") && (
        <ul className="space-y-2 text-sm">
          {((data?.announcements as Array<Record<string, unknown>>) || []).map((a) => (
            <li key={String(a.announcementId)} className="rounded-xl border border-border p-3">
              <p className="font-medium">{String(a.title)}</p>
              <p className="text-xs text-muted">{String(a.kind)}</p>
              {a.testMode ? <p className="text-amber-300 text-xs">TEST</p> : null}
            </li>
          ))}
        </ul>
      )}
    </MobileShell>
  );
}

export function MobileMapClient({ user }: { user: SafeUser }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    fetch("/api/mobile/map", { credentials: "include" })
      .then((r) => r.json())
      .then(setData);
  }, []);
  return (
    <MobileShell user={user} title="Map">
      <p className="text-sm text-white/60">Step 14 map — field overlay</p>
      <Link
        href="/map"
        className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-sky-600 text-sm font-semibold"
      >
        Open full map
      </Link>
      <pre className="mt-4 overflow-auto rounded-xl border border-border p-3 text-[10px] text-white/60">
        {JSON.stringify(data?.map || {}, null, 2)}
      </pre>
    </MobileShell>
  );
}
