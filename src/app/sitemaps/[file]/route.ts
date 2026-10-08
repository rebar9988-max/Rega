import { sitemapRecords, urlset, xmlNoStoreMark } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ file: string }> }) {
  const records = await sitemapRecords((await ctx.params).file);
  if (!records) return new Response("Not found", { status: 404 });
  return new Response(urlset(records) + xmlNoStoreMark(records), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
