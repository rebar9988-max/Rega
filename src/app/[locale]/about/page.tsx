import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSchema } from "@/components/ui/PageSchema";
import { isLocale } from "@/i18n/locales";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMetadata({ locale, path: "/about", title: t("title"), description: t("intro") });
}

const ICONS = [
  <g key="a"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></g>,
  <path key="b" d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6l-7-3Zm-3 8.8 2.2 2.2L15.5 9.6" />,
  <path key="c" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />,
];

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const tn = await getTranslations("nav");
  const offers = t.raw("offer") as { label: string; text: string }[];

  return (
    <>
      <PageSchema type="AboutPage" name={t("title")} description={t("intro")} path="/about" crumbs={[{ name: t("title"), path: "/about" }]} />
      <PageHeader title={t("title")} crumbs={[{ label: tn("home"), href: "/" }, { label: t("title") }]} />
      <div className="container-page max-w-3xl space-y-10 pb-8">
        <div className="space-y-4 text-base text-ink sm:text-lg">
          <p className="font-semibold">{t("intro")}</p>
          <p className="text-muted">{t("goal")}</p>
        </div>

        <section aria-labelledby="about-offer">
          <h2 id="about-offer" className="border-s-4 border-brand ps-3 text-xl font-extrabold sm:text-2xl">{t("offerH")}</h2>
          <ul className="mt-5 grid grid-cols-1 gap-4">
            {offers.map((o, i) => (
              <li key={o.label} className="card-lift flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[i]}</svg>
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold">{o.label}</h3>
                  <p className="mt-1 text-sm text-muted sm:text-base">{o.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <blockquote className="rounded-[var(--radius-card)] border-s-4 border-brand bg-brand-soft px-6 py-5 text-lg font-bold text-ink">
          {t("quote")}
        </blockquote>
      </div>
    </>
  );
}
