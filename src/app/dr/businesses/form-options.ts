import "server-only";
import { prisma } from "@/lib/db";
import { localize } from "@/lib/content";
import { FORM_COUNTRIES } from "@/lib/business-admin";
import type { Locale } from "@/i18n/locales";
import type { FormCity } from "@/components/dr/BusinessForm";

/** Options for the business form: real categories, countries and cities from the database (plus ISO countries). */
export async function formOptions(locale: Locale) {
  const [categories, countries, cities] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { nameDe: "asc" }], select: { id: true, parentId: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameTr: true } }),
    prisma.country.findMany({ select: { code: true, nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameTr: true } }),
    prisma.city.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameTr: true, latitude: true, longitude: true, country: { select: { code: true } } } }),
  ]);
  const display = (() => { try { return new Intl.DisplayNames([locale, "en"], { type: "region" }); } catch { return null; } })();
  const codes = [...new Set([...countries.map((c) => c.code), ...FORM_COUNTRIES])];
  const countryName = (code: string) => {
    const row = countries.find((c) => c.code === code);
    return (row ? localize({ ...row, name: row.nameEn }, "name", locale).text : null) || display?.of(code) || code;
  };
  return {
    categories: categories.map((c) => ({ id: c.id, name: `${c.parentId ? "— " : ""}${localize({ ...c, name: c.nameDe }, "name", locale).text}` })),
    countries: codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => Number(b.code === "DE") - Number(a.code === "DE") || a.name.localeCompare(b.name)),
    cities: cities.map<FormCity>((c) => ({
      id: c.id, name: localize({ ...c, name: c.nameEn }, "name", locale).text,
      names: [c.nameEn, c.nameCkb, c.nameKmr, c.nameDe, c.nameAr, c.nameTr].filter((n): n is string => Boolean(n)),
      countryCode: c.country.code, lat: c.latitude, lng: c.longitude,
    })),
  };
}
