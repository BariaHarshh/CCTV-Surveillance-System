import Link from "next/link";

const entries = [
  { version: "0.11.0", date: "2026-08-23", notes: "Production platform APIs: billing, settings, MFA, webhooks, onboarding, search, and super-admin ops." },
  { version: "0.10.0", date: "2026-08-01", notes: "Analytics, reports, executive dashboard, and corrective actions." },
  { version: "0.9.0", date: "2026-07-15", notes: "Emergency command center, playbooks, and escalation." },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-2xl">
        <Link href="/help" className="text-sm text-accent">← Help</Link>
        <h1 className="mt-4 text-3xl font-bold">Changelog</h1>
        <ul className="mt-8 space-y-6">
          {entries.map((e) => (
            <li key={e.version} className="rounded-2xl border border-border bg-surface/40 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">v{e.version}</h2>
                <span className="text-xs text-muted">{e.date}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{e.notes}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
