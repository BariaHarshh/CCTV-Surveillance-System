import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffSuccessClient } from "@/components/admin/StaffSuccessClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Created | Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function StaffSuccessPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login?redirect=/admin/staff/success&reason=session_required");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8">
          <div className="h-32 w-full max-w-lg animate-pulse rounded-2xl bg-glass" />
        </div>
      }
    >
      <StaffSuccessClient user={toSafeUser(session.user)} />
    </Suspense>
  );
}
