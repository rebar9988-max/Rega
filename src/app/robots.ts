import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const host = process.env.CANONICAL_HOST || "www.regaplatform.com";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dr/"] }],
    sitemap: `https://${host}/sitemap.xml`,
    host: `https://${host}`,
  };
}
