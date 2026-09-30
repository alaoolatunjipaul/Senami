import type { NextConfig } from "next";

/**
 * Senami - Next.js configuration.
 *
 * The application is intentionally served with conservative, security-oriented
 * defaults (see docs/SECURITY.md). Provider credentials and secrets are never
 * embedded here; they are read from validated environment variables in
 * `lib/env.ts` on the server only.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // React Compiler auto-memoises components, which matters for a data-heavy UI
  // with live-updating queues.
  reactCompiler: true,
  // Type-safe `href` values across the app. Route literals are checked at build
  // time, so a renamed or deleted route fails typecheck rather than 404ing.
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Content Security Policy (Phase 3).
          //
          // `'unsafe-inline'` appears where Next injects bootstrap scripts and
          // inline styles; tightening to nonce-based scripts is tracked for a
          // later hardening pass. Everything else is locked to the same origin,
          // and frames/objects are refused outright.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
