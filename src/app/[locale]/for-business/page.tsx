import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import NextLink from "next/link";
import { PageSchema } from "@/components/ui/PageSchema";
import { Link } from "@/i18n/routing";
import { isLocale } from "@/config/locales";
import { pageDescription } from "@/lib/seo-server";
import { pageMetadata } from "@/lib/seo";
import { currentAccount } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { getCategories } from "@/lib/data";
import { localizeText } from "@/lib/content";
import { HomeIcon } from "@/components/home/icons";
import { BusinessForm } from "@/components/dr/BusinessForm";
import { formOptions } from "@/app/dr/businesses/form-options";
import { GALLERY_PHOTOS } from "@/lib/business-admin";
import { isStorageConfigured } from "@/lib/env";
import { PremiumHero, FeatureNav, styles as s } from "@/components/migration/Premium";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "forBusiness" });
  return pageMetadata({ locale, path: "/for-business", title: t("title"), description: await pageDescription(locale, "forBusiness") });
}

export default async function ForBusinessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const [user, categories] = await Promise.all([currentAccount(), getCategories()]);
  const ownerForm = user && can(user.role, "business.write") && !can(user.role, "business.publish");
  const cta = user
    ? <NextLink href="/dr/businesses/new" className={s.button}>{t("forBusiness.ctaAdd")}</NextLink>
    : <Link href="/register?next=%2Fdr%2Fbusinesses%2Fnew" className={s.button} data-testid="cta-register">{t("forBusiness.ctaRegister")}</Link>;
  return <div className={s.page} data-testid="premium-business">
    <PageSchema name={t("forBusiness.title")} description={t("pageMeta.forBusiness")} path="/for-business" crumbs={[{ name: t("forBusiness.title"), path: "/for-business" }]} />
    <FeatureNav business={t("forBusiness.title")} ai={t("ai.title")} cities={t("locations.title")} />
    <PremiumHero eyebrow="100% FREE · Rega24" title={t("premiumPages.businessHero")} lead={t("forBusiness.lead")}
      art={<>{categories.filter(c => !c.parentId).slice(0,3).map(c=><div className={s.mini} key={c.id}><span className={s.symbol} aria-hidden="true"><HomeIcon name="all" className="size-6" /></span><div><strong>{localizeText({...c,name:c.nameDe},"name",locale)}</strong><p>{t("services.category")}</p></div></div>)}</>}>
      <a className={s.button} href="#registration">{t("forBusiness.ctaRegister")}</a><a className={s.secondary} href="#benefits">{t("forBusiness.benefitsTitle")}</a>
    </PremiumHero>
    <section id="benefits" className={s.section}><div className={s.inner}>
      <span className={s.eyebrow}>{t("forBusiness.benefitsTitle")}</span><h2>{t("forBusiness.freeTitle")}</h2>
      <p className="mb-7" data-testid="free-statement">{t("forBusiness.freeBody")}</p>
      <div className={s.grid3}>{[["🎁","freeTitle","freeBody"],["📍","b2Title","b2Text"],["🌐","b1Title","b1Text"]].map(([icon,title,text])=><article className={s.tile} key={title}><span className={s.symbol} aria-hidden="true">{icon}</span><h3>{t(`forBusiness.${title}`)}</h3><p>{t(`forBusiness.${text}`)}</p></article>)}</div>
    </div></section>
    <section className={`${s.section} ${s.tint}`}><div className={s.inner}><h2>{t("premiumPages.categories")}</h2><div className={s.chips}>{categories.filter(c=>!c.parentId).slice(0,6).map(c=><Link className={s.pill} href={`/businesses/${c.slug}`} key={c.id}>{localizeText({...c,name:c.nameDe},"name",locale)}</Link>)}</div></div></section>
    <section className={s.section}><div className={s.inner}><h2>{t("forBusiness.stepsTitle")}</h2><ol className={s.grid3}>{[["s1","s2"],["s3"],["s4"]].map((keys,i)=><li className={s.tile} key={i}><span className={s.eyebrow} aria-hidden="true">{i+1}</span>{keys.map(k=><p className="mt-3" key={k}>{t(`forBusiness.${k}`)}</p>)}</li>)}</ol></div></section>
    <section id="registration" className={`${s.section} ${s.tint}`}><div className={s.inner}><div className={s.panel}>
      <div className={s.panelIntro}><h2>{t("forBusiness.ctaRegister")}</h2><p>{t("premiumPages.approvalAnswer")}</p></div>
      {ownerForm
        ? <NextIntlClientProvider messages={await getMessages()}><BusinessForm initial={{countryCode:"DE"}} {...await formOptions(locale)} canPublish={false} storageReady={isStorageConfigured()} maxPhotos={GALLERY_PHOTOS} /></NextIntlClientProvider>
        : <div className={s.actions}>{cta}{!user && <Link className={s.secondary} href="/login?next=%2Fdr%2Fbusinesses%2Fnew">{t("forBusiness.ctaLogin")}</Link>}</div>}
    </div></div></section>
    <section className={`${s.section} ${s.faq}`}><div className={s.inner}><h2>{t("premiumPages.faq")}</h2>{[["premiumPages.freeQuestion","forBusiness.freeBody"],["premiumPages.approvalQuestion","premiumPages.approvalAnswer"],["forBusiness.verifiedTitle","forBusiness.verifiedBody"]].map(([q,a])=><details key={q}><summary>{t(q)}</summary><p>{t(a)}</p></details>)}</div></section>
  </div>;
}
