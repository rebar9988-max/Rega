import "server-only";
import { prisma } from "@/lib/db";
import { localize } from "@/lib/content";
import type { Locale } from "@/i18n/locales";

/** Top-level categories (a category can be nested one level deep). */
export async function parentOptions(locale: Locale) {
  const rows = await prisma.category.findMany({
    where: { deletedAt: null, parentId: null }, orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }],
    select: { id: true, nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true },
  });
  return rows.map((c) => ({ id: c.id, name: localize({ ...c, name: c.nameDe }, "name", locale).text }));
}
