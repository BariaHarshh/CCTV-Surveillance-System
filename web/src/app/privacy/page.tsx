export default function Page() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-2xl prose prose-invert">
        <p className="text-sm uppercase tracking-widest text-muted">AI Campus Guardian</p>
        <h1 className="mt-2 text-3xl font-bold">Privacy policy</h1>
        <div className="mt-8 space-y-4 text-sm text-muted leading-relaxed">
          <p>We process account, operational, and safety telemetry data necessary to deliver campus security intelligence for your organization.</p>
          <p>Organization data is isolated by tenant. We do not sell personal data. Access is limited to authorized operators and platform administrators.</p>
          <p>Contact privacy@aicampusguardian.com for data subject requests applicable under local law.</p>
        </div>
      </div>
    </div>
  );
}
