import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSchema } from "@/components/ui/PageSchema";
import { HomeIcon } from "@/components/home/icons";
import { ContactForm } from "@/components/contact/ContactForm";
import { isLocale } from "@/i18n/locales";
import { CONTACT, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "contact" });
  return pageMetadata({ locale, path: "/contact", title: t("title"), description: t("intro") });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  return (
    <>
      <PageSchema type="ContactPage" name={t("title")} description={t("intro")} path="/contact" crumbs={[{ name: t("title"), path: "/contact" }]} />
      <PageHeader title={t("heading")} />
      <div className="container-page max-w-3xl space-y-8 pb-8">
        {/* Phone is the only contact channel shown; the message form below sends to REGA's address internally. */}
        <a
          href={CONTACT.phone.href}
          aria-label={t("phoneAria", { value: CONTACT.phone.display })}
          data-testid="contact-phone"
          className="card-lift group flex min-h-16 items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card hover:border-brand/40"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white">
            <HomeIcon name="phone" className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-muted">{t("phone")}</span>
            <span className="block truncate text-base font-bold text-ink group-hover:text-brand"><bdi dir="ltr">{CONTACT.phone.display}</bdi></span>
          </span>
        </a>

        <section aria-labelledby="contact-form" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 id="contact-form" className="border-s-4 border-brand ps-3 text-xl font-extrabold">{t("formTitle")}</h2>
          <p className="mb-5 mt-2 text-sm text-muted">{t("formIntro")}</p>
          <ContactForm />
        </section>
      </div>
    </>
  );
}
