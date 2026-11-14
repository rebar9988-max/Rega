import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { isLocale } from "@/config/locales";
import { pageMetadata } from "@/lib/seo";
import { currentAccount } from "@/lib/auth-helpers";
import { localizeText } from "@/lib/content";
import { getCategories, getNearbyCities } from "@/lib/data";
import { SmartRequestForm } from "@/features/smart-request/SmartRequestForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "smartRequest" });
  return pageMetadata({ locale, path: "/smart-request/new", title: t("newTitle"), description: t("subtitle"), noindex: true });
}

export default async function NewSmartRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const user = await currentAccount().catch(() => null);
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/smart-request/new`)}`);
  const t = await getTranslations("smartRequest");
  const [categories, cities] = await Promise.all([getCategories().catch(() => []), getNearbyCities().catch(() => [])]);
  return (
    <>
      <PageHeader title={t("newTitle")} subtitle={t("subtitle")} crumbs={[{ label: t("title"), href: "/smart-request" }, { label: t("newTitle") }]} />
      <div className="container-page max-w-2xl pb-10">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:p-6">
          <SmartRequestForm
            categories={categories.map((c) => ({ id: c.id, label: localizeText(c, "name", locale) })).filter((c) => c.label)}
            cities={cities.map((c) => ({ id: c.id, label: localizeText(c, "name", locale) }))}
          />
        </section>
      </div>
    </>
  );
}
