import "server-only";
import { prisma } from "@/lib/db";
import { localize } from "@/lib/content";
import { managedBusinessWhere } from "@/lib/business-access";
import type { SessionUser } from "@/lib/auth-helpers";
import type { Locale } from "@/i18n/locales";

/** Businesses this user may attach services to, and the active categories (children marked with a dash). */
export async function serviceFormOptions(user: SessionUser, locale: Locale) {
  const [businesses, categories] = await Promise.all([
    prisma.business.findMany({
      where: { deletedAt: null, ...managedBusinessWhere(user) }, orderBy: { name: "asc" }, take: 2000,
      select: { id: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true },
    }),
    prisma.category.findMany({
      where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }],
      select: { id: true, parentId: true, nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true },
    }),
  ]);
  return {
    businesses: businesses.map((b) => ({ id: b.id, name: localize(b, "name", locale).text })),
    categories: categories.map((c) => ({ id: c.id, name: `${c.parentId ? "— " : ""}${localize({ ...c, name: c.nameDe }, "name", locale).text}` })),
  };
}
