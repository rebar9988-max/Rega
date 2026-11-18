import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import type { Locale } from "@/i18n/locales";
import { BusinessForm } from "@/components/dr/BusinessForm";
import { GALLERY_PHOTOS } from "@/lib/business-admin";
import { isStorageConfigured } from "@/lib/env";
import { formOptions } from "../form-options";

export default async function NewBusiness({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireDr("business.write");
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const all = await formOptions(locale);
  // Rega24Travel registration (/dr/businesses/new?travel=1): the same workflow, offering only travel categories.
  const travel = (await searchParams).travel === "1" && all.travelCategoryIds.length > 0;
  const options = travel ? { ...all, categories: all.categories.filter((c) => all.travelCategoryIds.includes(c.id)) } : all;
  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/businesses" className="text-muted hover:text-ink">{t("dashboard.businesses")}</Link></nav>
      <h1 className="mb-6 text-2xl font-extrabold">{travel ? t("travel.registerTitle") : t("bizForm.newTitle")}</h1>
      {travel && <p className="-mt-4 mb-6 text-sm text-muted" data-testid="travel-register-lead">{t("travel.registerLead")}</p>}
      <BusinessForm initial={{ countryCode: "DE" }} {...options} canPublish={can(user.role, "business.publish")} storageReady={isStorageConfigured()} maxPhotos={GALLERY_PHOTOS} />
    </>
  );
}
