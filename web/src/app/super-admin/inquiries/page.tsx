import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { InquiriesPageClient } from "@/components/super-admin/InquiriesPageClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Purchase Inquiries | Super Admin | AI Campus Guardian",
  robots: { index: false, follow: false },
};

export default async function SuperAdminInquiriesPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return <InquiriesPageClient user={toSafeUser(session.user)} />;
}
