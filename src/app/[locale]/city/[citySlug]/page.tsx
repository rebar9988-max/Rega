import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BusinessIndex } from "@/features/listings/BusinessIndex";
import { isLocale, type Locale } from "@/config/locales";
import { localizeText } from "@/lib/content";
import { getCityBySlug } from "@/lib/data";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";

type Props = { params: Promise<{ locale: string; citySlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const cityBySlug = (slug: string) => getCityBySlug(slug);

export async function generateMetadata({ params }: Props) {
  const { locale, citySlug } = await params;
  if (!isLocale(locale)) return {};
  const city = await cityBySlug(citySlug);
  if (!city) return {};
  const name = localizeText({ ...city, name: city.nameEn }, "name", locale);
  const t = await getTranslations({ locale, namespace: "seoPages" });
  return pageMetadata({ locale, path: `/city/${citySlug}`, title: t("inCity", { city: name }), description: await pageDescription(locale, "cityPage", { name }) });
}

/** /city/<slug>: the businesses of one city, from the geography the admin maintains. */
export default async function CityPage({ params, searchParams }: Props) {
  const { locale, citySlug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const city = await cityBySlug(citySlug);
  if (!city) notFound();
  const t = await getTranslations();
  const name = localizeText({ ...city, name: city.nameEn }, "name", locale as Locale);
  const title = t("seoPages.inCity", { city: name });
  return (
    <BusinessIndex
      pathname={`/city/${citySlug}`} searchParams={await searchParams} title={title} fixed={{ city: city.id }}
      crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("locations.title"), href: "/locations" }, { label: name }]}
    />
  );
}
