import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import type { Locale } from "@/i18n/locales";
import { ServiceForm } from "@/components/dr/ServiceForm";
import { SERVICE_CURRENCIES } from "@/lib/service-admin";
import { serviceFormOptions } from "../form-options";

export default async function NewService({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const user = await requireDr("service.write");
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const { business } = await searchParams;
  const options = await serviceFormOptions(user, locale);
  const preset = options.businesses.some((b) => b.id === business) ? business : undefined;
  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/services" className="text-muted hover:text-ink">{t("dashboard.services")}</Link></nav>
      <h1 className="mb-6 text-2xl font-extrabold">{t("svcForm.newTitle")}</h1>
      {options.businesses.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-6 text-sm text-muted" data-testid="services-no-business">{t("svcForm.needBusiness")}</p>
      ) : (
        <ServiceForm initial={{ businessId: preset, currency: "EUR" }} {...options} currencies={SERVICE_CURRENCIES} canPublish={can(user.role, "service.publish")} />
      )}
    </>
  );
}
