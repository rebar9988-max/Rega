import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSchema } from "@/components/ui/PageSchema";
import { isLocale } from "@/i18n/locales";
import { notFound } from "next/navigation";
import { pageDescription } from "@/lib/seo-server";
import { pageMetadata, socialProfiles, SOCIAL_DISPLAY_NAME } from "@/lib/seo";
import { ownerDetails } from "@/config/owner";
import { parseCmsBody } from "@/lib/cms";
import { getCmsPage } from "@/lib/cms-data";
import { Link } from "@/i18n/routing";

const SOCIAL_LABEL = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", x: "X", telegram: "Telegram", whatsapp: "WhatsApp" } as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMetadata({ locale, path: "/about", title: t("title"), description: await pageDescription(locale, "about") });
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
  const tc = await getTranslations("contact");
  const tl = await getTranslations("nav");
  const offers = t.raw("offer") as { label: string; text: string }[];
  // "Who we are": the operator from the owner details (shown once they are entered), the founding story from the CMS
  // page /dr/pages "about-story" (written by the owner; nothing is invented here), and the official social profiles.
  const owner = ownerDetails();
  const showOperator = !owner.missing.includes("legalName");
  const story = await getCmsPage("about-story", locale);
  const social = socialProfiles();

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

        {(showOperator || story || social.length > 0) && (
          <section aria-labelledby="about-who" data-testid="about-who">
            <h2 id="about-who" className="border-s-4 border-brand ps-3 text-xl font-extrabold sm:text-2xl">{tc("whoTitle")}</h2>
            <div className="mt-4 space-y-3 text-base">
              {showOperator && <p className="font-semibold"><bdi>{[owner.operatorType, owner.legalName].filter(Boolean).join(": ")}</bdi></p>}
              {story && parseCmsBody(story.body).map((b, i) => b.type === "h2" ? <h3 key={i} className="font-bold">{b.text}</h3> : b.type === "ul" ? <ul key={i} className="list-disc ps-6">{b.items.map((li, j) => <li key={j}>{li}</li>)}</ul> : <p key={i} className="text-muted">{b.text}</p>)}
              {showOperator && <p className="text-sm"><Link href="/impressum" className="font-semibold text-brand underline">{tl("impressum")}</Link></p>}
              {social.length > 0 && (
                <ul className="flex flex-wrap gap-3 text-sm">
                  {social.map((p) => <li key={p.key}><a href={p.url} rel="me noopener noreferrer" target="_blank" aria-label={`${SOCIAL_DISPLAY_NAME} — ${SOCIAL_LABEL[p.key]}`} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 font-semibold hover:border-brand/40 hover:text-brand"><span dir="ltr">{SOCIAL_LABEL[p.key]}</span></a></li>)}
                </ul>
              )}
            </div>
          </section>
        )}

        <blockquote className="rounded-[var(--radius-card)] border-s-4 border-brand bg-brand-soft px-6 py-5 text-lg font-bold text-ink">
          {t("quote")}
        </blockquote>
      </div>
    </>
  );
}
