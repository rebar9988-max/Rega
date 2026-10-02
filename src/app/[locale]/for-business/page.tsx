import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSchema } from "@/components/ui/PageSchema";
import { buttonClass } from "@/components/ui/Button";
import { HomeIcon } from "@/components/home/icons";
import NextLink from "next/link";
import { Link } from "@/i18n/routing";
import { isLocale } from "@/config/locales";
import { pageDescription } from "@/lib/seo-server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "forBusiness" });
  return pageMetadata({ locale, path: "/for-business", title: t("title"), description: await pageDescription(locale, "forBusiness") });
}

const BENEFITS = [["b1Title", "b1Text", "all"], ["b2Title", "b2Text", "pin"], ["b3Title", "b3Text", "near"], ["b4Title", "b4Text", "legal"]] as const;

export default async function ForBusinessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("forBusiness");
  const tn = await getTranslations("nav");
  const tm = await getTranslations("pageMeta");
  const signedIn = Boolean((await auth().catch(() => null))?.user);

  return (
    <>
      <PageSchema name={t("title")} description={tm("forBusiness")} path="/for-business" crumbs={[{ name: t("title"), path: "/for-business" }]} />
      <PageHeader title={t("title")} subtitle={t("lead")} crumbs={[{ label: tn("home"), href: "/" }, { label: t("title") }]} />
      <div className="container-page max-w-4xl space-y-12 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          {signedIn
            ? <NextLink href="/dr/businesses/new" className={buttonClass("primary")}>{t("ctaAdd")}</NextLink>
            : <>
                <Link href="/register" className={buttonClass("primary")} data-testid="cta-register">{t("ctaRegister")}</Link>
                <Link href="/login?next=%2Fdr%2Fbusinesses%2Fnew" className="text-sm font-semibold text-brand underline">{t("ctaLogin")}</Link>
              </>}
        </div>

        <section aria-labelledby="fb-free" className="rounded-[var(--radius-card)] border-s-4 border-brand bg-brand-soft px-6 py-5" data-testid="free-statement">
          <h2 id="fb-free" className="text-xl font-extrabold">{t("freeTitle")}</h2>
          <p className="mt-2 text-base font-semibold">{t("freeBody")}</p>
        </section>

        <section aria-labelledby="fb-benefits">
          <h2 id="fb-benefits" className="border-s-4 border-brand ps-3 text-xl font-extrabold sm:text-2xl">{t("benefitsTitle")}</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {BENEFITS.map(([title, text, icon]) => (
              <li key={title} className="card-lift flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><HomeIcon name={icon} className="size-5" /></span>
                <div className="min-w-0"><h3 className="text-base font-bold">{t(title)}</h3><p className="mt-1 text-sm text-muted sm:text-base">{t(text)}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="fb-steps">
          <h2 id="fb-steps" className="border-s-4 border-brand ps-3 text-xl font-extrabold sm:text-2xl">{t("stepsTitle")}</h2>
          <ol className="mt-5 space-y-3">
            {(["s1", "s2", "s3", "s4"] as const).map((k, i) => (
              <li key={k} className="flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-extrabold text-brand-ink">{i + 1}</span>
                <p className="pt-1 text-base">{t(k)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="fb-verified">
          <h2 id="fb-verified" className="border-s-4 border-brand ps-3 text-xl font-extrabold sm:text-2xl">{t("verifiedTitle")}</h2>
          <p className="mt-3 text-base text-muted">{t("verifiedBody")}</p>
        </section>

        <div>
          {signedIn
            ? <NextLink href="/dr/businesses/new" className={buttonClass("primary")}>{t("ctaAdd")}</NextLink>
            : <Link href="/register" className={buttonClass("primary")}>{t("ctaRegister")}</Link>}
        </div>
      </div>
    </>
  );
}
