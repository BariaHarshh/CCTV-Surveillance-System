import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/health", destination: "/api/health/live" },
      { source: "/ready", destination: "/api/health/ready" },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      {
        key: "X-DNS-Prefetch-Control",
        value: "on",
      },
    ];
    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
      // Conservative CSP — maps/video/AI may need additional host allowlists via env later
      const connectSrc = ["'self'", appOrigin].filter(Boolean).join(" ");
      securityHeaders.push({
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "img-src 'self' data: blob: https:",
          "media-src 'self' blob: https:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          `connect-src ${connectSrc} https: wss:`,
          "object-src 'none'",
        ].join("; "),
      });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
