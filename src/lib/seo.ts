/**
 * SEO helpers: canonical host, per-page alternates (hreflang), Open Graph / X metadata and
 * Organization structured data. Every URL is built on the canonical host (https://www.regaplatform.com),
 * never on the request host, so apex/preview hosts can never leak into canonicals or social cards.
 */
import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, type Locale } from "@/i18n/locales";

/**
 * Brand identity. "REGA" alone is ambiguous (Real Estate General Authority, Saudi Arabia is an unrelated
 * organisation), so the full name "REGA Platform" is used for every entity signal: <title>, og:site_name,
 * Organization / WebSite JSON-LD, footer, social display names.
 */
export const BRAND_NAME = "REGA Platform";
export const BRAND_NAME_KU = "ڕێگا";
export const SITE_NAME = BRAND_NAME;
export const SOCIAL_DISPLAY_NAME = BRAND_NAME;

/** Official REGA contact details (shown in the footer). */
export const CONTACT = {
  phone: { display: "+49 178 4228269", href: "tel:+491784228269" },
  email: { display: "info@regaplatform.com", href: "mailto:info@regaplatform.com" },
} as const;

export function siteHost(): string {
  return process.env.CANONICAL_HOST || "www.regaplatform.com";
}
export function siteOrigin(): string {
  return `https://${siteHost()}`;
}

/** URL of a localized page on the canonical host. `path` is "" for the home page, else "/businesses/x". */
export function localizedUrl(locale: Locale, path = ""): string {
  return `${siteOrigin()}/${locale}${path}`;
}

/** Canonical + hreflang alternates (incl. x-default) for one page. Relative URLs resolve against metadataBase. */
export function pageAlternates(locale: Locale, path = ""): NonNullable<Metadata["alternates"]> {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [LOCALE_META[l].htmlLang, `/${l}${path}`])),
      "x-default": `/${DEFAULT_LOCALE}${path}`,
    },
  };
}

type PageMeta = {
  locale: Locale;
  path?: string;
  title: string;
  description?: string;
  image?: string | null;
  /** Utility pages (search, account, login) stay crawlable for links but out of the index. */
  noindex?: boolean;
  ogType?: "website" | "article";
};

/** Complete page metadata. Open Graph / Twitter objects replace (not merge with) the layout's, so they are complete here. */
export function pageMetadata({ locale, path = "", title, description, image, noindex, ogType = "website" }: PageMeta): Metadata {
  // An explicit `images` (even undefined) suppresses the file-based default, so always fall back to the shared card.
  const images = image ? [image] : [{ url: `${siteOrigin()}/opengraph-image.png`, width: 1200, height: 630, alt: SITE_NAME }];
  return {
    title,
    description,
    alternates: pageAlternates(locale, path),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      url: localizedUrl(locale, path),
      title,
      description,
      locale: LOCALE_META[locale].htmlLang.replace("-", "_"),
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => LOCALE_META[l].htmlLang.replace("-", "_")),
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

/* ---- Official social profiles (configuration only; nothing is invented) ---- */

const PLATFORMS = [
  { key: "facebook", env: "SOCIAL_FACEBOOK_URL", hosts: ["facebook.com", "fb.com"] },
  { key: "instagram", env: "SOCIAL_INSTAGRAM_URL", hosts: ["instagram.com"] },
  { key: "tiktok", env: "SOCIAL_TIKTOK_URL", hosts: ["tiktok.com"] },
  { key: "youtube", env: "SOCIAL_YOUTUBE_URL", hosts: ["youtube.com", "youtu.be"] },
  { key: "linkedin", env: "SOCIAL_LINKEDIN_URL", hosts: ["linkedin.com"] },
  { key: "x", env: "SOCIAL_X_URL", hosts: ["x.com", "twitter.com"] },
  { key: "telegram", env: "SOCIAL_TELEGRAM_URL", hosts: ["t.me", "telegram.me"] },
  { key: "whatsapp", env: "SOCIAL_WHATSAPP_CHANNEL_URL", hosts: ["whatsapp.com"] },
] as const;

export type SocialKey = (typeof PLATFORMS)[number]["key"];
export type SocialProfile = { key: SocialKey; url: string };

/** Accepts only https URLs on the platform's own domain; anything else is ignored. */
export function parseSocialUrl(value: string | undefined, hosts: readonly string[]): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^(www|m|web)\./, "");
    return hosts.some((h) => host === h || host.endsWith(`.${h}`)) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Official profiles that are actually configured, in a stable order. */
export function socialProfiles(env: Record<string, string | undefined> = process.env): SocialProfile[] {
  return PLATFORMS.flatMap((p) => {
    const url = parseSocialUrl(env[p.env], p.hosts);
    return url ? [{ key: p.key, url }] : [];
  });
}

/** Stable @id values: every schema on the site points at the same Organization / WebSite entities. */
export const orgId = () => `${siteOrigin()}/#organization`;
export const websiteId = () => `${siteOrigin()}/#website`;

/** Organization + WebSite structured data. Only facts that are true and visible on the site; no invented identifiers. */
export function organizationJsonLd(locale: Locale, description: string, env: Record<string, string | undefined> = process.env) {
  const origin = siteOrigin();
  const sameAs = socialProfiles(env).map((p) => p.url);
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": orgId(),
      name: BRAND_NAME,
      alternateName: BRAND_NAME_KU,
      url: `${origin}/`,
      logo: { "@type": "ImageObject", url: `${origin}/brand/rega-logo.webp`, width: 512, height: 512 },
      description,
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": websiteId(),
      name: BRAND_NAME,
      alternateName: BRAND_NAME_KU,
      url: `${origin}/`,
      inLanguage: LOCALE_META[locale].htmlLang,
      publisher: { "@id": orgId() },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${origin}/${locale}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export type SchemaCrumb = { name: string; path: string };

/** WebPage (+ BreadcrumbList) tied to the WebSite/Organization by @id. `crumbs` are localized paths without the locale prefix. */
export function webPageJsonLd(opts: { locale: Locale; path?: string; name: string; description?: string; type?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage"; crumbs?: SchemaCrumb[] }) {
  const { locale, path = "", name, description, type = "WebPage", crumbs } = opts;
  const url = localizedUrl(locale, path);
  const page = {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    ...(description ? { description } : {}),
    inLanguage: LOCALE_META[locale].htmlLang,
    isPartOf: { "@id": websiteId() },
    publisher: { "@id": orgId() },
    ...(crumbs?.length ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
  };
  if (!crumbs?.length) return [page];
  return [
    page,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: localizedUrl(locale, c.path) })),
    },
  ];
}
