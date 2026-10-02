import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { NearbyDiscovery, type NearbyCategory, type NearbyCity, type NearbyInitial } from "@/components/nearby/NearbyDiscovery";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSchema } from "@/components/ui/PageSchema";
import { isLocale } from "@/i18n/locales";
import { getCategories, getNearbyCities } from "@/lib/data";
import { log } from "@/lib/logger";
import { pageMetadata } from "@/lib/seo";
import { NoEdgeCache } from "@/components/ui/NoEdgeCache";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "nearby" });
  return pageMetadata({ locale, path: "/nearby", title: t("title"), description: t("subtitle") });
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
      <PageHeader title={t("nearby.title")} subtitle={t("nearby.subtitle")} crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("nearby.title") }]} />
      <NearbyDiscovery cities={cities as unknown as NearbyCity[]} categories={categories.filter((c) => !c.parentId) as unknown as NearbyCategory[]} initial={initial} />
    </>
  );
}
