import { permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BusinessIndex } from "@/features/listings/BusinessIndex";
import { isLocale } from "@/config/locales";
import { getCategories } from "@/lib/data";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import { hasPublicBusinesses } from "@/lib/indexable";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "nav" });
  return pageMetadata({ locale, path: "/businesses", title: t("businesses"), description: await pageDescription(locale, "businesses"), noindex: !(await hasPublicBusinesses()) });
}

type Sp = Record<string, string | string[] | undefined>;

export default async function BusinessesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Sp> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  // Old filter URLs (?category=<id>) move permanently to the readable category URL (the middleware does it with a 301
  // before the page renders; this is the fallback when the middleware's lookup was unavailable).
  const categoryId = typeof sp.category === "string" ? sp.category : undefined;
  if (categoryId) {
    const category = (await getCategories()).find((c) => c.id === categoryId);
    if (category) {
      const rest = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (k !== "category" && typeof v === "string" ? [[k, v]] : [])));
      permanentRedirect(`/${locale}/businesses/${category.slug}${rest.size ? `?${rest}` : ""}`);
    }
  }

  const t = await getTranslations();
  return <BusinessIndex pathname="/businesses" searchParams={sp} title={t("businesses.title")} crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("businesses.title") }]} />;
}
