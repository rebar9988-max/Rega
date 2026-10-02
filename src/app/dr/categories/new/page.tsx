import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireDr } from "@/lib/dr-auth";
import type { Locale } from "@/i18n/locales";
import { CategoryForm } from "@/components/dr/CategoryForm";
import { parentOptions } from "../parent-options";
import { sectionOptions } from "../section-options";

export default async function NewCategory() {
  await requireDr("category.write");
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/categories" className="text-muted hover:text-ink">{t("dashboard.categories")}</Link></nav>
      <h1 className="mb-6 text-2xl font-extrabold">{t("catForm.newTitle")}</h1>
      <CategoryForm initial={{ sectionKey: "businesses" }} parents={await parentOptions(locale)} sections={await sectionOptions()} />
    </>
  );
}
