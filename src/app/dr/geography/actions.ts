"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { slugify } from "@/lib/api";
import { COLUMN_NAME_LOCALES as COLUMN_LOCALES, LOCALES, localeSuffix } from "@/config/locales";

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const num = (min: number, max: number) => z.union([z.literal(""), z.coerce.number().min(min).max(max)]).optional().transform((v) => (v === "" || v === undefined ? undefined : v));
const slug = z.string().trim().max(80).optional().transform((v) => (v ? slugify(v) : undefined));

const countrySchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/), nameEn: z.string().trim().min(2).max(120), lat: num(-90, 90), lng: num(-180, 180) });
const regionSchema = z.object({ countryId: z.string().min(1).max(64), nameEn: z.string().trim().min(2).max(120), slug });
const citySchema = z.object({
  id: text(64), countryId: z.string().min(1).max(64), regionId: text(64), nameEn: z.string().trim().min(2).max(120), slug,
  lat: num(-90, 90), lng: num(-180, 180), sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
});

/** Names of a country or city for the launch languages (columns name<Locale>); English is `nameEn`. */
function localizedNames(formData: FormData, locales: readonly string[]) {
  return Object.fromEntries(locales.flatMap((l) => {
    const v = String(formData.get(`name${localeSuffix(l)}`) ?? "").trim().slice(0, 120);
    return v ? [[`name${localeSuffix(l)}`, v]] : [];
  }));
}

export async function saveCountryAction(formData: FormData): Promise<void> {
  const user = await requirePermission("category.write");
  const parsed = countrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dr/geography?error=invalid");
  const { code, nameEn, lat, lng } = parsed.data;
  if (await prisma.country.findUnique({ where: { code }, select: { id: true } })) redirect("/dr/geography?error=exists");
  const created = await prisma.country.create({ data: { code, nameEn, latitude: lat ?? null, longitude: lng ?? null, ...localizedNames(formData, COLUMN_LOCALES) } });
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: "country.create", entity: "Country", entityId: created.id, after: { code } });
  revalidatePath("/", "layout");
  redirect("/dr/geography?saved=1");
}

export async function saveRegionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("category.write");
  const parsed = regionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dr/geography?error=invalid");
  const { countryId, nameEn } = parsed.data;
  const regionSlug = parsed.data.slug ?? slugify(nameEn);
  if (await prisma.region.findUnique({ where: { countryId_slug: { countryId, slug: regionSlug } }, select: { id: true } })) redirect("/dr/geography?error=exists");
  const region = await prisma.region.create({ data: { countryId, slug: regionSlug, nameEn } });
  // Translations in rows keyed by locale (any language, no schema change).
  await prisma.regionTranslation.create({ data: { regionId: region.id, locale: "en", name: nameEn } });
  for (const l of LOCALES.filter((x) => x !== "en")) {
    const name = String(formData.get(`name${localeSuffix(l)}`) ?? "").trim().slice(0, 120);
    if (name) await prisma.regionTranslation.create({ data: { regionId: region.id, locale: l, name } });
  }
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: "region.create", entity: "Region", entityId: region.id, after: { slug: regionSlug } });
  revalidatePath("/", "layout");
  redirect("/dr/geography?saved=1");
}

/** Create or update a city. The slug (/city/<slug>) is unique across all countries. */
export async function saveCityAction(formData: FormData): Promise<void> {
  const user = await requirePermission("category.write");
  const parsed = citySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/dr/geography?error=invalid`);
  const { id, countryId, regionId, nameEn, lat, lng, sortOrder } = parsed.data;
  const citySlug = parsed.data.slug ?? slugify(nameEn);
  const clash = await prisma.city.findFirst({ where: { slug: citySlug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) redirect(id ? `/dr/geography/city/${id}?error=slug` : "/dr/geography?error=exists");
  const names = localizedNames(formData, COLUMN_LOCALES);
  // An admin-saved city belongs in the public filter immediately, even with no business yet.
  const data = { countryId, regionId: regionId ?? null, nameEn, slug: citySlug, latitude: lat ?? null, longitude: lng ?? null, sortOrder, inDirectory: true, ...names };
  let cityId = id;
  if (id) {
    if (!(await prisma.city.findUnique({ where: { id }, select: { id: true } }))) redirect("/dr/geography?error=invalid");
    // Names the admin cleared are cleared (not kept): every name column is part of the form.
    await prisma.city.update({ where: { id }, data: { ...Object.fromEntries(COLUMN_LOCALES.map((l) => [`name${localeSuffix(l)}`, null])), ...data } });
  } else {
    cityId = (await prisma.city.create({ data })).id;
  }
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: id ? "city.update" : "city.create", entity: "City", entityId: cityId, after: { slug: citySlug } });
  revalidatePath("/", "layout");
  redirect(`/dr/geography/city/${cityId}?saved=1`);
}

const toggleSchema = z.object({ entity: z.enum(["country", "region", "city"]), id: z.string().min(1).max(64), active: z.enum(["0", "1"]) });

/** Hide or show a country, region or city. Nothing is deleted; listings keep their references. */
export async function setGeoActive(formData: FormData): Promise<void> {
  const user = await requirePermission("category.write");
  const { entity, id, active } = toggleSchema.parse(Object.fromEntries(formData));
  const isActive = active === "1";
  if (entity === "country") await prisma.country.update({ where: { id }, data: { isActive } });
  else if (entity === "region") await prisma.region.update({ where: { id }, data: { isActive } });
  else await prisma.city.update({ where: { id }, data: { isActive } });
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: `${entity}.${isActive ? "activate" : "deactivate"}`, entity, entityId: id, after: { isActive } });
  revalidatePath("/", "layout");
}
