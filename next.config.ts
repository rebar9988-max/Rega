import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import path from "node:path";
import { mapStyleOrigin } from "./src/lib/map-config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Canonical host handling: regaplatform.com -> www.regaplatform.com (301, keeps path + query)
const CANONICAL_HOST = process.env.CANONICAL_HOST || "www.regaplatform.com";
const APEX_HOST = CANONICAL_HOST.replace(/^www\./, "");

// Content-Security-Policy. Inline scripts are needed by Next.js hydration, the theme script and JSON-LD (no nonce
// pipeline yet), so script-src keeps 'unsafe-inline'; external scripts only from our own origin (and Cloudflare's
// analytics beacon, below),
// plugins/objects are off, the site cannot be framed, and forms/base URIs cannot point elsewhere.
const storageOrigin = (() => {
  try { return process.env.STORAGE_ENDPOINT ? new URL(process.env.STORAGE_ENDPOINT).origin : ""; } catch { return ""; }
})();
// Cloudflare Web Analytics: Cloudflare injects its beacon only when Web Analytics is switched on for this site in the
// Cloudflare dashboard, so it is intentional; without these two exact origins the CSP blocked it (console error, no
// data). Cookie-less, and nothing else is allowed: no other third-party script can load.
const CF_ANALYTICS_SCRIPT = "https://static.cloudflareinsights.com";
const CF_ANALYTICS_REPORT = "https://cloudflareinsights.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${CF_ANALYTICS_SCRIPT}${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Map style, vector tiles, glyphs and sprites come from the configured basemap origin (src/lib/map-config.ts).
  `connect-src 'self' ${mapStyleOrigin()} ${CF_ANALYTICS_REPORT}${storageOrigin ? ` ${storageOrigin}` : ""}`,
  // MapLibre's worker is served from our own origin (public/vendor/maplibre); blob: for its classic fallback.
  "worker-src 'self' blob:",
  "media-src 'self' https:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

// Set by `npm run build` (Cloudflare Workers / OpenNext). Node builds (`build:node`, Docker, CI E2E) leave it unset.
const onWorkers = process.env.REGA_TARGET === "workers";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  webpack(config) {
    // Workers build only: swap the DB module for the WASM/Hyperdrive-aware client (Node keeps src/lib/db.ts).
    if (onWorkers) config.resolve.alias[path.resolve(__dirname, "src/lib/db.ts")] = path.resolve(__dirname, "src/lib/db.workers.ts");
    return config;
  },
  images: {
    remotePatterns: [
      ...(process.env.MEDIA_PUBLIC_HOST
        ? [{ protocol: "https" as const, hostname: process.env.MEDIA_PUBLIC_HOST }]
        : []),
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Admin/owner dashboard: never indexed (it also requires sign-in).
      { source: "/dr/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/dr", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async redirects() {
    // /favicon.ico is a real file in public/ (served as a static asset, no Worker invocation): no redirect needed.
    if (APEX_HOST === CANONICAL_HOST) return [];
    // The `has.value` of a host condition is a REGEX. It must be anchored and escaped: an unanchored
    // "regaplatform.com" also matches "www.regaplatform.com", which made www redirect to itself (redirect loop).
    const apexOnly = [{ type: "host" as const, value: `^${APEX_HOST.replace(/\./g, "\\.")}$` }];
    return [
      // Two rules instead of "/:path*": OpenNext leaves ":path*" unsubstituted for the empty path ("/").
      { source: "/", has: apexOnly, destination: `https://${CANONICAL_HOST}/`, statusCode: 301 },
      { source: "/:path+", has: apexOnly, destination: `https://${CANONICAL_HOST}/:path+`, statusCode: 301 },
    ];
  },
};

export default withNextIntl(nextConfig);
