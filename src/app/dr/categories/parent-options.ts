import "server-only";
import { prisma } from "@/lib/db";
import { localize } from "@/lib/content";
import { descendantIds, treeOrder } from "@/lib/category-tree";
import type { Locale } from "@/i18n/locales";

/** Possible parents: every category (any depth) in tree order, indented; the category itself and its descendants are left out. */
export async function parentOptions(locale: Locale, excludeId?: string) {
  const rows = await prisma.category.findMany({
    where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }],
    select: { id: true, parentId: true, nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true },
  });
  const excluded = new Set(excludeId ? descendantIds(rows, excludeId) : []);
  return treeOrder(rows).filter((c) => !excluded.has(c.id)).map((c) => ({ id: c.id, name: `${"— ".repeat(c.depth)}${localize({ ...c, name: c.nameDe }, "name", locale).text}` }));
}
