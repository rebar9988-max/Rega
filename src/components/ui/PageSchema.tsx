import { getLocale, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/ui/JsonLd";
import type { Locale } from "@/i18n/locales";
import { webPageJsonLd, type SchemaCrumb } from "@/lib/seo";

type Props = { path?: string; name: string; description?: string; type?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage"; crumbs?: SchemaCrumb[] };

/** WebPage + BreadcrumbList structured data for a visible page; linked to the site Organization by @id. */
export async function PageSchema(props: Props) {
  const locale = (await getLocale()) as Locale;
  const home = (await getTranslations("nav"))("home");
  const crumbs = props.crumbs ? [{ name: home, path: "" }, ...props.crumbs] : undefined;
  return <JsonLd data={webPageJsonLd({ ...props, locale, crumbs })} />;
}
