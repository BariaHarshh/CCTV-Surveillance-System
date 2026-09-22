import { NextRequest } from "next/server";
import { ensureDbReady } from "@/lib/auth/init-super-admin";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { canViewMonitoring } from "@/lib/monitoring/permissions";
import { getStreamSessionProxy } from "@/lib/monitoring/stream-service";

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDbReady();
    const { user, organizationId } = await requireOrgMember();
    if (!canViewMonitoring(user)) {
      return new Response("Forbidden", { status: 403 });
    }

    const { sessionId } = await params;
    const proxy = await getStreamSessionProxy(sessionId, organizationId);
    if (!proxy) return new Response("Stream unavailable", { status: 404 });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let upstream: Response;
    try {
      upstream = await fetch(proxy.fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }

    if (!upstream.ok) return new Response("Stream connection failed", { status: 502 });

    const contentType = upstream.headers.get("content-type") ?? proxy.contentType;
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response("Stream error", { status: 500 });
  }
}
