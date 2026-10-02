import "server-only";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/config/locales";
import { DESCRIPTION_MIN, fitDescription } from "./seo";

/** Meta description of a page (`pageMeta.<key>` in the catalogue, `{vars}` filled), fitted to 120–155 characters. */
export async function pageDescription(locale: Locale, key: string, vars?: Record<string, string>): Promise<string> {
  const [t, tf] = await Promise.all([getTranslations({ locale, namespace: "pageMeta" }), getTranslations({ locale, namespace: "footer" })]);
  return fitDescription(t(key, vars), tf("tagline"));
}

/** A free text (a listing's own description) fitted to 120–155 characters; empty text falls back to `fallbackKey` of `pageMeta`. */
export async function descriptionFrom(locale: Locale, text: string | null | undefined, fallbackKey: string, vars: Record<string, string>): Promise<string> {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return pageDescription(locale, fallbackKey, vars);
  const tf = await getTranslations({ locale, namespace: "footer" });
  // A very short text ("Wir suchen Verstärkung.") would stay below the search-result length even with the tagline:
  // continue it with the page's generated description, which is always 120-155 characters.
  if (clean.length < DESCRIPTION_MIN - 40) return fitDescription(`${clean.replace(/[.。]$/, "")}. ${await pageDescription(locale, fallbackKey, vars)}`, tf("tagline"));
  return fitDescription(clean, tf("tagline"));
}
