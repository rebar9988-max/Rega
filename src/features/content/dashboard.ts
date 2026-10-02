import "server-only";
import { prisma } from "@/lib/db";
import { localize } from "@/lib/content";
import { managedBusinessWhere } from "@/lib/business-access";
import type { SessionUser } from "@/lib/auth-helpers";
import type { Locale } from "@/config/locales";
import { sectionCategories, sectionCities } from "./queries";
import type { ContentSection } from "./config";

/** Choices of the entry form: the businesses the user manages (all for staff), the active cities and the section's categories. */
export async function entryFormOptions(section: ContentSection, user: Pick<SessionUser, "id" | "role">, locale: Locale) {
  const [businesses, cities, categories] = await Promise.all([
    prisma.business.findMany({
      where: { deletedAt: null, ...managedBusinessWhere(user) },
      orderBy: { name: "asc" }, take: 500,
      select: { id: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true },
    }),
    sectionCities(section),
    sectionCategories(section),
  ]);
  return {
    businesses: businesses.map((b) => ({ id: b.id, name: localize({ ...b }, "name", locale).text })),
    cities: cities.map((c) => ({ id: c.id, name: localize({ ...c, name: c.nameEn }, "name", locale).text })),
    categories: categories.map((c) => ({ id: c.id, name: localize({ ...c, name: c.nameEn }, "name", locale).text })),
  };
}
