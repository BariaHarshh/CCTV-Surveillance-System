import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { StaffPlaceholderClient } from "@/components/staff/StaffPlaceholderClient";

const pages = {
  reports: { title: "Reports", description: "Advanced reporting will be expanded in a future release." },
} as const;

export default async function StaffPlaceholderRoute({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getAuthSession();
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages] ?? pages.reports;
  if (!session) return null;
  return <StaffPlaceholderClient user={toSafeUser(session.user)} title={page.title} description={page.description} />;
}
