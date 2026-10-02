import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSchema } from "@/components/ui/PageSchema";
import { isLocale, LOCALE_META } from "@/config/locales";
import { PAGE_SLUG, parseCmsBody } from "@/lib/cms";
import { getCmsPage } from "@/lib/cms-data";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !PAGE_SLUG.test(slug)) return {};
  const page = await getCmsPage(slug, locale);
  if (!page) return {};
  return pageMetadata({ locale, path: `/p/${slug}`, title: page.title, description: page.metaDescription ?? undefined });
}

/** A static page written in the admin CMS (/dr/pages), in the visitor's language with the usual fallbacks. */
export default async function CmsPageRoute({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !PAGE_SLUG.test(slug)) notFound();
  setRequestLocale(locale);
  const page = await getCmsPage(slug, locale);
  if (!page) notFound();
  const meta = LOCALE_META[page.locale];
  return (
    <>
      <PageSchema name={page.title} description={page.metaDescription ?? undefined} path={`/p/${slug}`} crumbs={[{ name: page.title, path: `/p/${slug}` }]} />
      <PageHeader title={page.title} />
      <article className="container-page max-w-3xl space-y-4 pb-8" lang={meta.htmlLang} dir={meta.dir}>
        {parseCmsBody(page.body).map((b, i) =>
          b.type === "h2" ? <h2 key={i} className="pt-2 text-xl font-extrabold">{b.text}</h2>
          : b.type === "ul" ? <ul key={i} className="list-disc space-y-1 ps-6 leading-7">{b.items.map((li, j) => <li key={j}>{li}</li>)}</ul>
          : <p key={i} className="whitespace-pre-line leading-7">{b.text}</p>)}
      </article>
    </>
  );
}
