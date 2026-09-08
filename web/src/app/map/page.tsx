import { Suspense } from "react";
import { getAuthSession } from "@/lib/auth/session";
import { toSafeUser } from "@/lib/auth/sanitize-user";
import { DigitalCampusMapClient } from "@/components/map/DigitalCampusMapClient";

export default async function MapPage() {
  const session = await getAuthSession();
  if (!session) return null;
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading map…</div>}>
      <DigitalCampusMapClient user={toSafeUser(session.user)} />
    </Suspense>
  );
}
