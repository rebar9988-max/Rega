import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSchema } from "@/components/ui/PageSchema";
import { HomeIcon } from "@/components/home/icons";
import { ContactForm } from "@/features/contact/ContactForm";
import { isLocale } from "@/config/locales";
import { ownerDetails } from "@/config/owner";
import { pageDescription } from "@/lib/seo-server";
import { pageMetadata, socialProfiles, SOCIAL_DISPLAY_NAME } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "contact" });
  return pageMetadata({ locale, path: "/contact", title: t("title"), description: await pageDescription(locale, "contact") });
}

const SOCIAL_LABEL = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", x: "X", telegram: "Telegram", whatsapp: "WhatsApp" } as const;

/** Digits only, as wa.me expects ("+49 178 4228269" -> "491784228269"). */
const waNumber = (phone: string) => phone.replace(/\D/g, "");

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const owner = ownerDetails();
  const social = socialProfiles();
  const phoneDigits = waNumber(owner.phone);
  // The postal address is shown only once the operator has entered it (it always appears in the Impressum).
  const address = owner.missing.includes("streetAddress") || owner.missing.includes("postalCodeCity") ? null : `${owner.streetAddress}, ${owner.postalCodeCity}`;

  const card = "card-lift group flex min-h-16 items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card hover:border-brand/40";
  const icon = "grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white";
  const channels = [
    { key: "phone", testid: "contact-phone", href: `tel:+${phoneDigits}`, icon: "phone", label: t("phone"), value: owner.phone, aria: t("phoneAria", { value: owner.phone }) },
    { key: "email", testid: "contact-email", href: `mailto:${owner.publicEmail}`, icon: "mail", label: t("email"), value: owner.publicEmail, aria: t("emailAria", { value: owner.publicEmail }) },
    { key: "whatsapp", testid: "contact-whatsapp", href: `https://wa.me/${phoneDigits}`, icon: "phone", label: t("whatsapp"), value: owner.phone, aria: t("whatsappAria", { value: owner.phone }), external: true },
  ];

  return (
    <>
      <PageSchema type="ContactPage" name={t("title")} description={t("intro")} path="/contact" crumbs={[{ name: t("title"), path: "/contact" }]} />
      <PageHeader title={t("heading")} />
      <div className="container-page max-w-3xl space-y-8 pb-8">
        <ul aria-label={t("channels")} className="grid gap-3 sm:grid-cols-2">
          {channels.map((c) => (
            <li key={c.key}>
              <a href={c.href} aria-label={c.aria} data-testid={c.testid} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={card}>
                <span className={icon}><HomeIcon name={c.icon} className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-muted">{c.label}</span>
                  <span className="block truncate text-base font-bold text-ink group-hover:text-brand"><bdi dir="ltr">{c.value}</bdi></span>
                </span>
              </a>
            </li>
          ))}
          {address && (
            <li className="sm:col-span-2">
              <div data-testid="contact-address" className="flex min-h-16 items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
                <span className={icon}><HomeIcon name="pin" className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-muted">{t("address")}</span>
                  <address className="block text-base font-bold not-italic text-ink">{address}</address>
                </span>
              </div>
            </li>
          )}
        </ul>

        {social.length > 0 && (
          <nav aria-label={SOCIAL_DISPLAY_NAME}>
            <ul className="flex flex-wrap gap-3 text-sm">
              {social.map((p) => (
                <li key={p.key}>
                  <a href={p.url} rel="me noopener noreferrer" target="_blank" aria-label={`${SOCIAL_DISPLAY_NAME} — ${SOCIAL_LABEL[p.key]}`} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 font-semibold hover:border-brand/40 hover:text-brand">
                    <span dir="ltr">{SOCIAL_LABEL[p.key]}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <section aria-labelledby="contact-form" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 id="contact-form" className="border-s-4 border-brand ps-3 text-xl font-extrabold">{t("formTitle")}</h2>
          <p className="mb-5 mt-2 text-sm text-muted">{t("formIntro")}</p>
          <ContactForm />
        </section>
      </div>
    </>
  );
}
