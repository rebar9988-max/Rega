import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import type { Locale } from "@/i18n/locales";
import { ContentForm } from "@/components/dr/ContentForm";
import { CONTENT } from "@/features/content/config";
import { entryFormOptions } from "@/features/content/dashboard";
import { contentSection } from "../../guard";

export default async function NewEntry({ params }: { params: Promise<{ section: string }> }) {
  const section = contentSection((await params).section);
  const config = CONTENT[section];
  const user = await requireDr(config.write);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const options = await entryFormOptions(section, user, locale);
  return (
    <>
      <nav className="mb-2 text-sm"><Link href={`/dr/content/${section}`} className="text-muted hover:text-ink">{t(`nav.${section}`)}</Link></nav>
      <h1 className="mb-6 text-2xl font-extrabold">{t("content.newEntry")}</h1>
      <ContentForm section={section} initial={{}} {...options} requiresBusiness={config.requiresBusiness} canPublish={can(user.role, config.publish)} />
    </>
  );
}
