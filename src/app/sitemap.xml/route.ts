import { sitemapFiles, sitemapIndex, xmlNoStoreMark } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** Sitemap index: lists the files of /sitemaps (see src/lib/sitemap.ts). */
export async function GET() {
  const files = await sitemapFiles();
  return new Response(sitemapIndex(files) + xmlNoStoreMark(files), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
