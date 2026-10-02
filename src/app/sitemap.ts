import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { DEFAULT_LOCALE, LOCALES, LOCALE_META } from "@/i18n/locales";
import { siteOrigin } from "@/lib/seo";

export const dynamic = "force-dynamic";

const STATIC = ["", "/businesses", "/services", "/locations", "/nearby", "/ai", "/about", "/contact"];
const LIMIT = 4000; // sitemap protocol cap is 50k URLs; six locales per record (2 record types x 4000 x 6 = 48k)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = siteOrigin();
  // One <url> per locale, each listing every alternate (incl. itself and x-default), as Google's hreflang sitemap spec requires.
  const entry = (path: string, lastModified?: Date) =>
    LOCALES.map((locale) => ({
      url: `${host}/${locale}${path}`,
      lastModified,
      alternates: {
        languages: {
          ...Object.fromEntries(LOCALES.map((l) => [LOCALE_META[l].htmlLang, `${host}/${l}${path}`])),
          "x-default": `${host}/${DEFAULT_LOCALE}${path}`,
        },
      },
    }));

  let dynamicPaths: { path: string; at: Date }[] = [];
  try {
    const [businesses, services] = await Promise.all([
      prisma.business.findMany({ where: { status: "published", deletedAt: null }, select: { slug: true, updatedAt: true }, take: LIMIT, orderBy: { updatedAt: "desc" } }),
      prisma.service.findMany({ where: { status: "published", deletedAt: null, business: { status: "published", deletedAt: null } }, select: { slug: true, updatedAt: true, business: { select: { slug: true } } }, take: LIMIT, orderBy: { updatedAt: "desc" } }),
    ]);
    dynamicPaths = [
      ...businesses.map((b) => ({ path: `/businesses/${b.slug}`, at: b.updatedAt })),
      ...services.map((s) => ({ path: `/services/${s.business.slug}/${s.slug}`, at: s.updatedAt })),
    ];
  } catch {
    // Database unavailable: still serve the static routes rather than failing the crawl.
  }
  return [...STATIC.flatMap((p) => entry(p)), ...dynamicPaths.flatMap((d) => entry(d.path, d.at))];
}
