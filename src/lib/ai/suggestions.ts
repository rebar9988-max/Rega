/** Where to send someone whose question found nothing: real categories (most listings first) and the free "add your business" page. */
import "server-only";
import { prisma } from "@/lib/db";
import { localizeText } from "@/lib/content";
import type { Locale } from "@/config/locales";

export type Suggestion = { label: string; url: string };

export async function categorySuggestions(locale: Locale, take = 4): Promise<Suggestion[]> {
  try {
    const [categories, counts] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true, deletedAt: null, parentId: null }, orderBy: [{ sortOrder: "asc" }], select: { id: true, nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } }),
      prisma.business.groupBy({ by: ["categoryId"], where: { status: "published", deletedAt: null, categoryId: { not: null } }, _count: { _all: true } }),
    ]);
    const n = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return categories
      .sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0))
      .slice(0, take)
      .map((c) => ({ label: localizeText({ ...c, name: c.nameDe }, "name", locale), url: `/${locale}/businesses?category=${c.id}` }));
  } catch {
    return []; // suggestions are a courtesy; the "nothing found" answer stands without them
  }
}
