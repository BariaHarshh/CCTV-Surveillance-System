export default function Page() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-2xl prose prose-invert">
        <p className="text-sm uppercase tracking-widest text-muted">AI Campus Guardian</p>
        <h1 className="mt-2 text-3xl font-bold">Security</h1>
        <div className="mt-8 space-y-4 text-sm text-muted leading-relaxed">
          <p>AI Campus Guardian uses encrypted transport, hashed credentials, optional MFA, audit logging, and organization isolation controls.</p>
          <p>API keys and webhook secrets are shown once at creation and stored as irreversible hashes.</p>
          <p>Report vulnerabilities to security@aicampusguardian.com. Do not include secrets in public reports.</p>
        </div>
      </div>
    </div>
  );
}
