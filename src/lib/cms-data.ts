import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { LOCALE_META, fallbackChain, type Locale } from "@/config/locales";

export type CmsPage = { slug: string; title: string; body: string; metaDescription: string | null; locale: Locale; fallback: boolean };

/** A published page in `locale`, else in the first language of the fallback chain that has it (then `fallback` is true). */
export const getCmsPage = cache(async (slug: string, locale: Locale): Promise<CmsPage | null> => {
  const page = await prisma.page.findFirst({ where: { slug, status: "published" }, include: { translations: true } });
  if (!page) return null;
  for (const l of [locale, ...fallbackChain(locale)]) {
    const t = page.translations.find((x) => x.locale === l);
    if (t) return { slug, title: t.title, body: t.body, metaDescription: t.metaDescription, locale: l, fallback: l !== locale };
  }
  return null;
});

export const htmlLangOf = (l: Locale) => LOCALE_META[l].htmlLang;
