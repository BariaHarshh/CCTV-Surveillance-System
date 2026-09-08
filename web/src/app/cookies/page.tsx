export default function Page() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-2xl prose prose-invert">
        <p className="text-sm uppercase tracking-widest text-muted">AI Campus Guardian</p>
        <h1 className="mt-2 text-3xl font-bold">Cookie policy</h1>
        <div className="mt-8 space-y-4 text-sm text-muted leading-relaxed">
          <p>We use essential session cookies to authenticate users and maintain secure sessions.</p>
          <p>Preference cookies may store UI state such as sidebar collapse. We do not use third-party advertising cookies.</p>
          <p>You can clear cookies in your browser; doing so will sign you out of active sessions.</p>
        </div>
      </div>
    </div>
  );
}
