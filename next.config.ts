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
        ],
      },
    ];
  },
};

export default nextConfig;
