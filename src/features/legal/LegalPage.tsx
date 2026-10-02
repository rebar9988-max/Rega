import { Fragment, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSchema } from "@/components/ui/PageSchema";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatDate, isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { LEGAL_UPDATED, legalTexts, type LegalKey } from ".";

/** E-mail addresses and https links inside the texts become real links; everything else stays plain text. */
const LINKS = /(https?:\/\/[^\s)]+[^\s).,;]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;
function linkify(text: string): ReactNode {
  return text.split(LINKS).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    const external = part.startsWith("http");
    return (
      <a key={i} href={external ? part : `mailto:${part}`} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="font-semibold text-brand underline" dir="ltr">{part}</a>
    );
  });
}

/** `generateMetadata` for one legal page. */
export function legalMetadata(key: LegalKey, path: string) {
  return async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const doc = legalTexts(locale)[key];
    return pageMetadata({ locale, path, title: doc.title, description: doc.description });
  };
}

/** One legal page. Renders the locale's text; non-German locales get a note that links to the binding German original. */
export function legalPage(key: LegalKey, path: string) {
  return async function Page({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    setRequestLocale(locale);
    const texts = legalTexts(locale);
    const doc = texts[key];
    const meta = LOCALE_META[locale];
    return (
      <>
        <PageSchema name={doc.title} description={doc.description} path={path} crumbs={[{ name: doc.title, path }]} />
        <PageHeader title={doc.title} subtitle={`${texts.ui.updated}: ${formatDate(LEGAL_UPDATED, locale)}`} />
        <article className="container-page max-w-3xl space-y-6 pb-8" data-testid={`legal-${key}`}>
          {locale !== "de" && (
            <p role="note" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
              {texts.ui.translationNote}{" "}
              <Link href={path} locale="de" hrefLang="de" className="font-semibold text-brand underline">{texts.ui.germanLink}</Link>
            </p>
          )}
          {doc.blocks.map((block, i) => (
            <section key={i} aria-labelledby={`${key}-${i}`} lang={meta.htmlLang} className="space-y-2">
              <h2 id={`${key}-${i}`} className="text-lg font-extrabold">{block.h}</h2>
              {block.p?.map((para, j) => <p key={j} dir="auto" className="leading-7 text-ink/90">{linkify(para)}</p>)}
              {block.ul && (
                <ul className="list-disc space-y-1 ps-6 leading-7 text-ink/90">
                  {block.ul.map((item, j) => <li key={j} dir="auto">{linkify(item)}</li>)}
                </ul>
              )}
            </section>
          ))}
        </article>
      </>
    );
  };
}
