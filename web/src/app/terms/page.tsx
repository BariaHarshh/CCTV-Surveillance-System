export default function Page() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-2xl prose prose-invert">
        <p className="text-sm uppercase tracking-widest text-muted">AI Campus Guardian</p>
        <h1 className="mt-2 text-3xl font-bold">Terms of service</h1>
        <div className="mt-8 space-y-4 text-sm text-muted leading-relaxed">
          <p>By accessing AI Campus Guardian you agree to use the platform only for lawful campus safety operations authorized by your institution.</p>
          <p>Organizations are responsible for camera placement, consent notices, retention policies, and staff access control within their tenancy.</p>
          <p>We may update these terms; continued use after notice constitutes acceptance of the revised terms.</p>
        </div>
      </div>
    </div>
  );
}
