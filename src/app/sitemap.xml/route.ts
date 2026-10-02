import { sitemapFiles, sitemapIndex } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** Sitemap index: lists the files of /sitemaps (see src/lib/sitemap.ts). */
export async function GET() {
  return new Response(sitemapIndex(await sitemapFiles()), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
