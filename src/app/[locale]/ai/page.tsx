import { PageSchema } from "@/components/ui/PageSchema";
import { pageMetadata } from "@/lib/seo";
import { pageDescription } from "@/lib/seo-server";
import { isLocale } from "@/config/locales";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AiChat } from "@/components/ai/AiChat";
import { PremiumHero, FeatureNav, styles as s } from "@/components/migration/Premium";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({locale});
  return pageMetadata({ locale, path: "/ai", title: t("ai.title"), description: await pageDescription(locale, "ai") });
}
export default async function AiPage({ params }: { params: Promise<{ locale: string }> }) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  return <div className={s.page} data-testid="premium-ai">
    <PageSchema name={t("ai.title")} path="/ai" crumbs={[{ name: t("ai.title"), path: "/ai" }]} />
    <FeatureNav business={t("forBusiness.title")} ai={t("ai.title")} cities={t("locations.title")} />
    <PremiumHero eyebrow="REGA AI · Rega24" title={t("premiumPages.aiHero")} lead={t("ai.subtitle")}
      art={<><span className={s.eyebrow}>{t("premiumPages.examples")}</span>{[1,2].map(i=><div className={s.chat} key={i}>{t(`premiumPages.aiHeroQuestion${i}`)}</div>)}<p className="text-sm text-muted">{t("premiumPages.exampleNote")}</p></>}>
      <a href="#assistant" className={s.button}>{t("premiumPages.startAi")}</a><a href="#examples" className={s.secondary}>{t("premiumPages.examples")}</a>
    </PremiumHero>
    <section id="examples" className={s.section}><div className={s.inner}><h2>{t("premiumPages.examples")}</h2><div className={s.grid3}>{[1,2,3].map(i=><article className={s.tile} key={i}><span className={s.symbol} aria-hidden="true">{["📍","🍽️","💬"][i-1]}</span><h3>{t(`premiumPages.aiExample${i}`)}</h3><a className={s.pill} href="#assistant">{t("premiumPages.startAi")}</a></article>)}</div></div></section>
    <section id="assistant" className={`${s.section} ${s.tint}`}><div className={s.inner}><div className={s.panelIntro}><h2>{t("ai.title")}</h2><p>{t("ai.disclaimer")}</p></div><div className={s.panel}><AiChat /></div></div></section>
    <section className={`${s.section} ${s.faq}`}><div className={s.inner}><h2>{t("premiumPages.faq")}</h2><details><summary>{t("premiumPages.aiQuestion")}</summary><p>{t("premiumPages.aiAnswer")}</p></details></div></section>
  </div>;
}
