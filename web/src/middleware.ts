import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "acg_session";

const protectedPaths = [
  "/authenticated",
  "/dashboard-preview",
  "/super-admin",
  "/first-login-password",
  "/change-password",
  "/admin",
  "/staff",
  "/settings",
  "/notifications",
  "/search",
  "/ai-copilot",
  "/ai",
  "/enterprise",
  "/approvals",
  "/workspace",
  "/team",
  "/support",
  "/operations",
  "/map",
  "/campus",
  "/building",
  "/floor",
  "/assets",
  "/emergency",
  "/analytics",
  "/video",
  "/command",
  "/mobile",
  "/tasks",
  "/teams",
  "/field",
  "/supervisor",
  "/patrol",
  "/inspections",
  "/directory",
  "/announcements",
  "/communication",
  "/executive",
  "/governance",
  "/strategy",
  "/reports",
  "/incidents",
];

function addSecurityHeaders(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(self)"
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // connect-src includes websockets for Socket.IO; avoid unsafe-eval in production CSP when possible
  const csp = [
    "default-src 'self'",
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuthenticated = Boolean(sessionCookie);

  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    if (pathname.startsWith("/authenticated")) {
      loginUrl.searchParams.set("reason", "session_required");
    }
    const response = NextResponse.redirect(loginUrl);
    return addSecurityHeaders(response, requestId);
  }

  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);

  if (isProtected) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
  }

  return addSecurityHeaders(response, requestId);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
