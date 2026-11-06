import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { NearbyDiscovery, type NearbyCategory, type NearbyCity, type NearbyInitial } from "@/components/nearby/NearbyDiscovery";
import { PageSchema } from "@/components/ui/PageSchema";
import { formatNumber, isLocale } from "@/i18n/locales";
import { getCategories, getNearbyCities } from "@/lib/data";
import { log } from "@/lib/logger";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import { RADII_KM } from "@/lib/geo";
import { NoEdgeCache } from "@/components/ui/NoEdgeCache";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "nearby" });
  return pageMetadata({ locale, path: "/nearby", title: t("title"), description: await pageDescription(locale, "nearby") });
}

type Sp = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function NearbyPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Sp> }) {
  const { locale } = await params;
  const sp = await searchParams;
  // Filters from the URL (e.g. the home page's "Open now" link). Only well-formed values are passed on.
  const initial: NearbyInitial = {
    open: one(sp.open) === "1",
    category: /^[\w-]{1,64}$/.test(one(sp.category) ?? "") ? one(sp.category) : undefined,
    q: (one(sp.q) ?? "").trim().slice(0, 100) || undefined,
    radius: Number(one(sp.radius)) || undefined,
    sort: one(sp.sort) === "rating" ? "rating" : undefined,
  };
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  // Serialize labels once: browser and server ICU may choose different numerals for Sorani.
  const radiusLabels = Object.fromEntries(RADII_KM.map((radius) => [radius, t("nearby.km", { km: formatNumber(radius, locale) })]));
  // The manual city fallback must never take the page down: without it, device location still works.
  let degraded = false;
  const [cities, categories] = await Promise.all([
    getNearbyCities().catch((error) => { degraded = true; log.error("nearby.cities", { error: String(error) }); return []; }),
    getCategories().catch(() => { degraded = true; return []; }),
  ]);
  return (
    <>
      {degraded && <NoEdgeCache />}
      <PageSchema name={t("nearby.title")} description={t("nearby.subtitle")} path="/nearby" crumbs={[{ name: t("nearby.title"), path: "/nearby" }]} />
      <header className="container-page mb-4">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("nearby.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("nearby.subtitle")}</p>
      </header>
      <NearbyDiscovery radiusLabels={radiusLabels} cities={cities as unknown as NearbyCity[]} categories={categories.filter((c) => !c.parentId) as unknown as NearbyCategory[]} initial={initial} />
    </>
  );
}
