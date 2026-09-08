import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { SearchClient } from "@/components/platform/SearchClient";
import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;
  return <SearchClient user={toSafeUser(session.user)} initialQ={q ?? ""} />;
}
