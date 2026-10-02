import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const host = process.env.CANONICAL_HOST || "www.regaplatform.com";
  return {
    // The dashboard (/dr) is not listed here: robots.txt is public and would advertise the path, and a blocked URL cannot show
    // its noindex header. It is protected by sign-in and answers with X-Robots-Tag: noindex (next.config.ts) instead.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `https://${host}/sitemap.xml`,
    host: `https://${host}`,
  };
}
