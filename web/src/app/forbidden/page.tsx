import Link from "next/link";
import { ShieldOff } from "lucide-react";

export const metadata = {
  title: "Access Restricted | AI Campus Guardian",
};

export default function ForbiddenPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(239,68,68,0.08),transparent)]" />
      <div className="absolute inset-0 grid-pattern opacity-20" />

      <div className="gradient-border relative max-w-md rounded-3xl bg-surface/80 p-10 text-center backdrop-blur-sm">
        <ShieldOff className="mx-auto h-12 w-12 text-red-400" strokeWidth={1.25} />
        <h1 className="mt-8 text-3xl font-bold tracking-tight">ACCESS RESTRICTED</h1>
        <blockquote className="mt-4 text-sm leading-relaxed text-muted">
          You don&apos;t have permission to access this area of AI Campus Guardian.
        </blockquote>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-accent px-8 py-3 text-sm font-semibold text-background hover:bg-accent-dim"
        >
          Return to Platform
        </Link>
      </div>
    </div>
  );
}
