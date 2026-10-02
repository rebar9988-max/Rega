import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import type { Locale } from "@/i18n/locales";
import { BusinessForm } from "@/components/dr/BusinessForm";
import { formOptions } from "../form-options";

export default async function NewBusiness() {
  const user = await requireDr("business.write");
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const options = await formOptions(locale);
  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/businesses" className="text-muted hover:text-ink">{t("dashboard.businesses")}</Link></nav>
      <h1 className="mb-6 text-2xl font-extrabold">{t("bizForm.newTitle")}</h1>
      <BusinessForm initial={{ countryCode: "DE" }} {...options} canPublish={can(user.role, "business.publish")} />
    </>
  );
}
