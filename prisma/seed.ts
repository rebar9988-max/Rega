/**
 * Idempotent seed (upserts only — never deletes).
 *   npm run db:seed                         taxonomy + countries/cities
 *   SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… npm run db:seed     also creates the first SUPER_ADMIN
 *   SEED_DEMO=1 npm run db:seed             also loads a small demo dataset (development only)
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { normalizeSearch } from "../src/lib/text";
import { reindexAll } from "../src/lib/search-index";
import { CATEGORIES } from "./seed-data/categories";
import { CITIES, COUNTRIES, REGIONS } from "./seed-data/geography";
import { GERMAN_CITIES } from "./seed-data/german-cities";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const search = (...parts: (string | null | undefined)[]) => normalizeSearch(parts.filter(Boolean).join(" "));

/** Only fields that are still empty are filled: values an admin edited are never overwritten (idempotent, non-destructive). */
function fillEmpty<T extends Record<string, unknown>>(existing: T, wanted: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(wanted).filter(([k, v]) => v !== undefined && v !== null && (existing[k] === null || existing[k] === undefined || existing[k] === "")));
}

async function seedGeography() {
  const countries: Record<string, string> = {};
  for (const c of COUNTRIES) {
    const data = { nameEn: c.names.en, nameCkb: c.names.ckb, nameKmr: c.names.kmr, nameDe: c.names.de, nameAr: c.names.ar, nameFa: c.names.fa, nameTr: c.names.tr, latitude: c.lat, longitude: c.lng };
    const row = await prisma.country.upsert({ where: { code: c.code }, update: {}, create: { code: c.code, ...data } });
    const fill = fillEmpty(row, data);
    if (Object.keys(fill).length) await prisma.country.update({ where: { id: row.id }, data: fill });
    countries[c.code] = row.id;
  }
  const regions: Record<string, string> = {};
  for (const r of REGIONS) {
    const row = await prisma.region.upsert({ where: { countryId_slug: { countryId: countries[r.country], slug: r.slug } }, update: {}, create: { countryId: countries[r.country], slug: r.slug, nameEn: r.en } });
    regions[`${r.country}/${r.slug}`] = row.id;
    // Translations live in rows keyed by locale (a new language needs no schema change).
    for (const [locale, name] of [["en", r.en], ["de", r.de]] as const) {
      await prisma.regionTranslation.upsert({ where: { regionId_locale: { regionId: row.id, locale } }, update: {}, create: { regionId: row.id, locale, name } });
    }
  }
  const cities: Record<string, string> = {};
  // The imported Germany catalogue contains legitimate same-named municipalities and a few
  // transliteration collisions (for example Munster / Münster -> "munster"). The current
  // City schema intentionally requires a globally unique slug and a unique country + nameEn,
  // so seed only one deterministic representative for each name/slug. Existing curated CITIES
  // always win; imported rows never overwrite or delete anything already present.
  const curatedGermanCities = CITIES.filter((c) => c.country === "DE");
  const seenGermanNames = new Set(curatedGermanCities.map((c) => c.names.de));
  const seenGermanSlugs = new Set(curatedGermanCities.map((c) => c.slug));
  const germanCities = GERMAN_CITIES.flatMap((c) => {
    if (seenGermanNames.has(c.name) || seenGermanSlugs.has(c.slug)) return [];
    seenGermanNames.add(c.name);
    seenGermanSlugs.add(c.slug);
    return [{
      country: "DE", region: c.region, slug: c.slug, lat: c.lat, lng: c.lng,
      names: { ckb: c.name, kmr: c.name, de: c.name, en: c.name, ar: c.name, fa: c.name, tr: c.name },
    }];
  });
  const allCities = [...CITIES, ...germanCities];
  for (const [i, c] of allCities.entries()) {
    const countryId = countries[c.country];
    const data = { nameCkb: c.names.ckb, nameKmr: c.names.kmr, nameDe: c.names.de, nameAr: c.names.ar, nameFa: c.names.fa, nameTr: c.names.tr, slug: c.slug, regionId: c.region ? regions[`${c.country}/${c.region}`] : undefined, latitude: c.lat, longitude: c.lng };
    const row = await prisma.city.upsert({ where: { countryId_nameEn: { countryId, nameEn: c.names.en } }, update: {}, create: { countryId, nameEn: c.names.en, sortOrder: i, ...data } });
    const fill = fillEmpty(row, data);
    if (Object.keys(fill).length) await prisma.city.update({ where: { id: row.id }, data: fill });
    cities[c.names.en] = row.id;
  }
  console.log(`geography: ${COUNTRIES.length} countries, ${REGIONS.length} regions, ${allCities.length} cities (idempotent).`);
  return cities;
}

async function seedCategories() {
  const cats: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const n = c.names;
    const data = { nameCkb: n.ckb, nameKmr: n.kmr, nameDe: n.de, nameEn: n.en, nameAr: n.ar, nameFa: n.fa, nameTr: n.tr };
    const row = await prisma.category.upsert({ where: { key: c.key }, update: {}, create: { key: c.key, slug: c.key, ...data, icon: c.icon, sortOrder: i } });
    const fill = fillEmpty(row, { icon: c.icon, nameEn: n.en, nameFa: n.fa });
    if (Object.keys(fill).length) await prisma.category.update({ where: { id: row.id }, data: fill });
    cats[c.key] = row.id;
  }
  console.log(`categories: ${CATEGORIES.length} top-level categories (idempotent).`);
  return cats;
}

async function main() {
  const cities = await seedGeography();
  const cats = await seedCategories();

  await ensureAdmin();

  const COORDS: Record<string, [number, number]> = { Berlin: [52.52, 13.405], Erbil: [36.191, 44.009], Sulaymaniyah: [35.557, 45.435] };
  if (process.env.SEED_DEMO === "1" && process.env.NODE_ENV !== "production") {
    const demo = [
      { slug: "kurdistan-rechtsberatung", name: "Kurdistan Rechtsberatung", nameCkb: "ڕاوێژکاری یاسایی کوردستان", nameAr: "استشارات كردستان القانونية", description: "Rechtsberatung für Migration, Familie und Arbeit in Berlin.", descriptionCkb: "ڕاوێژکاری یاسایی بۆ کۆچ، خێزان و کار لە بەرلین.", verified: true, featured: true, ratingAvg: 4.8, ratingCount: 42, phone: "+49 30 1234567", email: "info@example.org", website: "https://example.org", city: "Berlin", addr: "Karl-Marx-Allee 12", postal: "10178", cc: "DE", cat: "legal", hours: { mon: "09:00–17:00", tue: "09:00–17:00", fri: "09:00–14:00" }, service: { name: "Erstberatung", nameCkb: "ڕاوێژی یەکەم", price: 60, dur: 45 } },
      { slug: "zagros-restaurant", name: "Zagros Restaurant", nameCkb: "چێشتخانەی زاگرۆس", nameKmr: "Xwarinxaneya Zagrosê", nameAr: "مطعم زاغروس", description: "Traditional Kurdish cuisine.", descriptionCkb: "خواردنی ڕەسەنی کوردی.", verified: true, featured: false, ratingAvg: 4.5, ratingCount: 120, phone: "+964 750 000 0000", city: "Erbil", addr: "Citadel Road 5", postal: "44001", cc: "IQ", cat: "food", hours: { sat: "12:00–23:00", sun: "12:00–23:00" }, service: { name: "Catering", nameCkb: "خزمەتگوزاری خواردن", price: 200, dur: null } },
      { slug: "sulaymaniyah-clinic", name: "Sulaymaniyah Clinic", nameCkb: "کلینیکی سلێمانی", nameAr: "عيادة السليمانية", verified: false, featured: true, ratingAvg: 0, ratingCount: 0, city: "Sulaymaniyah", addr: "Salim Street 20", cc: "IQ", cat: "health", service: { name: "General checkup", nameCkb: "پشکنینی گشتی", price: null, dur: 30 } },
    ];
    for (const d of demo) {
      const biz = await prisma.business.upsert({
        where: { slug: d.slug }, update: {},
        create: {
          slug: d.slug, name: d.name, nameCkb: d.nameCkb, nameKmr: (d as { nameKmr?: string }).nameKmr, nameAr: d.nameAr,
          description: d.description, descriptionCkb: d.descriptionCkb, phone: d.phone, email: d.email, website: d.website,
          status: "published", publishedAt: new Date(), verified: d.verified, featured: d.featured, ratingAvg: d.ratingAvg, ratingCount: d.ratingCount,
          searchText: search(d.name, d.nameCkb, d.nameAr, (d as { nameKmr?: string }).nameKmr, d.city),
          locations: { create: { addressLine1: d.addr, postalCode: d.postal, countryCode: d.cc, cityId: cities[d.city], isPrimary: true, openingHours: d.hours, latitude: COORDS[d.city]?.[0], longitude: COORDS[d.city]?.[1], searchText: search(d.addr, d.city, d.name) } },
          services: { create: { slug: "main", name: d.service.name, nameCkb: d.service.nameCkb, priceFrom: d.service.price, durationMin: d.service.dur, categoryId: cats[d.cat], status: "published", searchText: search(d.service.name, d.service.nameCkb, d.name) } },
        },
      });
      console.log("demo business:", biz.slug);
    }
  }

  // Search index: rebuilt for every business (idempotent). Brings rows written before the richer index up to date.
  console.log(`search index: ${await reindexAll(prisma)} businesses re-indexed.`);
}

/**
 * First SUPER_ADMIN from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. An existing account is never changed unless
 * SEED_ADMIN_RESET_PASSWORD=1 is set explicitly: then only its password hash is replaced (role, data untouched).
 * Logs state only (created / exists / reset, role, status); never the address or the password.
 */
async function ensureAdmin() {
  const rawEmail = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!rawEmail || !password) {
    console.log("admin: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set; skipped.");
    return;
  }
  // Login looks accounts up by the trimmed, lower-cased address, so store it the same way.
  const email = rawEmail.trim().toLowerCase();
  if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters");
  if (password !== password.trim()) throw new Error("SEED_ADMIN_PASSWORD starts or ends with whitespace (often a pasted newline); re-enter the secret without it");

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const superAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", deletedAt: null } });
  console.log(`admin: active SUPER_ADMIN accounts before seed: ${superAdmins}`);

  if (!existing) {
    await prisma.user.create({ data: { email, name: "REGA Admin", role: "SUPER_ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
    console.log("admin: SUPER_ADMIN created for the configured address.");
    return;
  }

  const state = `role=${existing.role}, status=${existing.status}, deleted=${existing.deletedAt !== null}, hasPassword=${existing.passwordHash !== null}, storedAddressNormalized=${existing.email === email}`;
  const passwordMatches = existing.passwordHash ? await bcrypt.compare(password, existing.passwordHash) : false;
  console.log(`admin: account for the configured address already exists (${state}); stored password matches secret: ${passwordMatches}`);

  if (process.env.SEED_ADMIN_RESET_PASSWORD !== "1") {
    if (!passwordMatches) console.log("admin: password NOT changed (existing accounts are never modified). Re-run with reset_admin_password=true to set it from SEED_ADMIN_PASSWORD.");
    return;
  }
  await prisma.user.update({ where: { id: existing.id }, data: { email, passwordHash: await bcrypt.hash(password, 12) } });
  console.log("admin: password reset from SEED_ADMIN_PASSWORD (role, status and all other data unchanged).");
}

main().finally(() => prisma.$disconnect());
