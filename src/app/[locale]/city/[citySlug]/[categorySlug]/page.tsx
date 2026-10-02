import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BusinessIndex } from "@/features/listings/BusinessIndex";
import { isLocale, type Locale } from "@/config/locales";
import { localizeText } from "@/lib/content";
import { getCategories, getCities } from "@/lib/data";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";

type Props = { params: Promise<{ locale: string; citySlug: string; categorySlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function resolve(citySlug: string, categorySlug: string) {
  const [cities, categories] = await Promise.all([getCities(), getCategories()]);
  const city = cities.find((c) => c.slug === citySlug);
  const category = categories.find((c) => c.slug === categorySlug);
  return city && category ? { city, category } : null;
}

export async function generateMetadata({ params }: Props) {
  const { locale, citySlug, categorySlug } = await params;
  if (!isLocale(locale)) return {};
  const r = await resolve(citySlug, categorySlug);
  if (!r) return {};
  const city = localizeText({ ...r.city, name: r.city.nameEn }, "name", locale);
  const category = localizeText({ ...r.category, name: r.category.nameDe }, "name", locale);
  const t = await getTranslations({ locale, namespace: "seoPages" });
  return pageMetadata({ locale, path: `/city/${citySlug}/${categorySlug}`, title: t("categoryInCity", { category, city }), description: await pageDescription(locale, "cityCategoryPage", { category, city }) });
}

/** /city/<city>/<category>: one category in one city. */
export default async function CityCategoryPage({ params, searchParams }: Props) {
  const { locale, citySlug, categorySlug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const r = await resolve(citySlug, categorySlug);
  if (!r) notFound();
  const t = await getTranslations();
  const city = localizeText({ ...r.city, name: r.city.nameEn }, "name", locale as Locale);
  const category = localizeText({ ...r.category, name: r.category.nameDe }, "name", locale as Locale);
  return (
    <BusinessIndex
      pathname={`/city/${citySlug}/${categorySlug}`} searchParams={await searchParams} title={t("seoPages.categoryInCity", { category, city })} fixed={{ category: r.category.id, city: r.city.id }}
      crumbs={[{ label: t("nav.home"), href: "/" }, { label: city, href: `/city/${citySlug}` }, { label: category }]}
    />
  );
}
