import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { notFound } from "next/navigation";

const pages = {
  users: {
    title: "Users",
    description: "Campus user management will be expanded in a future release. Use Staff and Invitations for account access today.",
  },
} as const;

export default async function AdminPlaceholderRoute({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getAuthSession();
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  if (!session) return null;
  return <AdminPlaceholderPage user={toSafeUser(session.user)} title={page.title} description={page.description} />;
}
