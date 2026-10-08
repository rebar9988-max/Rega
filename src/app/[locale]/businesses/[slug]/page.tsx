import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BusinessIndex } from "@/features/listings/BusinessIndex";
import { isLocale, type Locale } from "@/config/locales";
import { localizeText } from "@/lib/content";
import { getBusiness, getCategories } from "@/lib/data";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import { hasPublicBusinesses } from "@/lib/indexable";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const categoryBySlug = async (slug: string) => (await getCategories()).find((c) => c.slug === slug);

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const category = await categoryBySlug(slug);
  if (!category) return {}; // a business slug: this URL redirects, the target carries the metadata
  const name = localizeText({ ...category, name: category.nameDe }, "name", locale);
  return pageMetadata({ locale, path: `/businesses/${slug}`, title: name, description: await pageDescription(locale, "categoryPage", { name }), noindex: !(await hasPublicBusinesses(category.id)) });
}

/**
 * /businesses/<x>: <x> is a category slug (the readable category URL), or - for the old URLs - a business slug, which
 * moves permanently to /business/<slug>. Anything else is a 404.
 */
export default async function BusinessesSlugPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const category = await categoryBySlug(slug);
  if (!category) {
    if (await getBusiness(slug)) permanentRedirect(`/${locale}/business/${slug}`);
    notFound();
  }
  const t = await getTranslations();
  const name = localizeText({ ...category, name: category.nameDe }, "name", locale as Locale);
  return (
    <BusinessIndex
      pathname={`/businesses/${slug}`} searchParams={await searchParams} title={name} fixed={{ category: category.id }}
      crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("businesses.title"), href: "/businesses" }, { label: name }]}
    />
  );
}
