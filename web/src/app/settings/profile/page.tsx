import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";

export default async function Page() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role === "SUPER_ADMIN") redirect("/super-admin/profile");
  if (session.user.role === "STAFF") redirect("/staff/profile");
  redirect("/admin/profile");
}
