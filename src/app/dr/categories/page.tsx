import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { formatNumber, LOCALE_META, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { Text } from "@/components/ui/Bidi";
import { treeOrder } from "@/lib/category-tree";
import { setCategoryActive } from "./actions";

export default async function DrCategories() {
  await requireDr("category.write");
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const pageLang = LOCALE_META[locale].htmlLang;
  const rows = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }],
    select: {
      id: true, key: true, parentId: true, isActive: true, sortOrder: true, sectionKey: true,
      nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true,
      _count: { select: { businesses: { where: { deletedAt: null } }, services: { where: { deletedAt: null } } } },
    },
  });
  // Depth-first: each category is followed by its whole subtree (any depth), indented.
  const ordered = treeOrder(rows);
  const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";
  const langs = ["Ckb", "Kmr", "De", "En", "Ar", "Fa", "Tr"] as const;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("dashboard.categories")}</h1>
        <Link href="/dr/categories/new" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover">+ {t("catForm.new")}</Link>
      </div>
      <p className="mb-4 text-sm text-muted">{t("catForm.listHint")}</p>
      {rows.length === 0 ? <p className="text-muted">{t("dashboard.empty")}</p> : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-surface-2 text-muted"><tr>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("services.category")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("catForm.translations")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("dashboard.businesses")} / {t("dashboard.services")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {ordered.map((c) => (
                <tr key={c.id} data-testid="category-row">
                  <td className="px-4 py-3">
                    <span className="font-semibold">{"— ".repeat(c.depth)}<Text value={localize({ ...c, name: c.nameDe }, "name", locale)} pageLang={pageLang} /></span>
                    <div className="text-xs text-muted" dir="ltr">{c.key}{c.sectionKey !== "businesses" ? ` · ${c.sectionKey}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted" dir="ltr">{langs.filter((l) => c[`name${l}`]).map((l) => l.toLowerCase()).join(" · ")}</td>
                  <td className="px-4 py-3">{formatNumber(c._count.businesses, locale)} / {formatNumber(c._count.services, locale)}</td>
                  <td className="px-4 py-3">{c.isActive ? t("status.active") : t("catForm.inactive")}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                    <Link href={`/dr/categories/${c.id}`} className={`${btn} inline-flex items-center`}>{t("bizForm.edit")}</Link>
                    <form action={setCategoryActive}>
                      <input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={c.isActive ? "0" : "1"} />
                      <button type="submit" className={btn}>{c.isActive ? t("catForm.deactivate") : t("catForm.activate")}</button>
                    </form>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
