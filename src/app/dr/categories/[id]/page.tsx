import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import type { Locale } from "@/i18n/locales";
import { CategoryForm } from "@/components/dr/CategoryForm";
import { parentOptions } from "../parent-options";
import { sectionOptions } from "../section-options";

export default async function EditCategory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireDr("category.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const c = await prisma.category.findFirst({ where: { id, deletedAt: null } });
  if (!c) notFound();
  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/categories" className="text-muted hover:text-ink">{t("dashboard.categories")}</Link></nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("catForm.editTitle")}: <bdi>{c.nameDe}</bdi></h1>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold">{c.isActive ? t("status.active") : t("catForm.inactive")}</span>
      </div>
      {sp.saved && <p role="status" data-testid="form-notice" className="mb-6 rounded-xl bg-[oklch(0.95_0.05_150)] px-4 py-3 text-sm font-semibold text-[oklch(0.35_0.1_150)]">{t("bizForm.saved")}</p>}
      <CategoryForm key={c.updatedAt.toISOString()} initial={{ id: c.id, nameCkb: c.nameCkb, nameKmr: c.nameKmr, nameDe: c.nameDe, nameEn: c.nameEn, nameAr: c.nameAr, nameFa: c.nameFa, nameTr: c.nameTr, parentId: c.parentId, sortOrder: c.sortOrder, sectionKey: c.sectionKey }} parents={await parentOptions(locale, c.id)} sections={await sectionOptions()} />
    </>
  );
}
