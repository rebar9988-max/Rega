/**
 * Bulk import of businesses from CSV (admin tool). Every row becomes a listing in status "pending" (never published),
 * with an unconfirmed location, so a moderator still reviews and confirms each one. Cities must already exist in the
 * geography, categories must exist in the category tree. Duplicates (same name and address) are skipped, so a file can
 * be uploaded twice safely. Server-only; the caller checks permissions. Columns: docs/import-format.md.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { saveBusiness, businessFormSchema, type BusinessForm } from "@/lib/business-admin";
import { normalizeSearch } from "@/lib/text";
import { WEEK } from "@/lib/opening-hours";
import { LOCALES } from "@/config/locales";
import { parseCsv } from "./csv";

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_BYTES = 1_000_000;
export const IMPORT_REQUIRED = ["name", "category", "addressLine1", "city", "countryCode"] as const;
export const IMPORT_COLUMNS = [
  "name", "nameCkb", "category", "description", "descriptionCkb", "descriptionKmr", "descriptionDe", "descriptionAr", "descriptionTr", "descriptionEn", "descriptionFa",
  "phone", "email", "website", "addressLine1", "postalCode", "city", "countryCode", "latitude", "longitude", "languages", ...WEEK.map((d) => `hours_${d}`),
] as const;

export type RowResult = { line: number; name: string; status: "created" | "skipped" | "error"; message?: string };
export type ImportSummary =
  | { ok: true; dryRun: boolean; created: number; skipped: number; errors: number; rows: RowResult[] }
  | { ok: false; error: "no_file" | "too_large" | "too_many_rows" | "missing_columns" | "empty"; detail?: string };

const key = (v: string) => normalizeSearch(v);

async function lookups() {
  const [categories, cities] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, key: true, slug: true, nameCkb: true, nameKmr: true, nameDe: true, nameEn: true, nameAr: true, nameFa: true, nameTr: true } }),
    prisma.city.findMany({ where: { isActive: true }, select: { id: true, slug: true, nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true } }),
  ]);
  const category = new Map<string, string>();
  for (const c of categories) for (const v of [c.key, c.slug, c.nameCkb, c.nameKmr, c.nameDe, c.nameEn, c.nameAr, c.nameFa, c.nameTr]) if (v) category.set(key(v), c.id);
  const city = new Set<string>();
  for (const c of cities) for (const v of [c.slug, c.nameEn, c.nameCkb, c.nameKmr, c.nameDe, c.nameAr, c.nameFa, c.nameTr]) if (v) city.add(key(v));
  return { category, city };
}

/** One CSV row -> the admin form's input (validated by the same schema as the form), or an error message. */
export function rowToForm(row: Record<string, string>, categoryId: string | undefined): { ok: true; input: BusinessForm } | { ok: false; message: string } {
  if (!categoryId) return { ok: false, message: `unknown category "${row.category}"` };
  const langs = (row.languages ?? "").split(/[;|\s]+/).map((l) => l.trim().toLowerCase()).filter(Boolean);
  const badLang = langs.find((l) => !(LOCALES as readonly string[]).includes(l));
  if (badLang) return { ok: false, message: `unknown language code "${badLang}"` };
  const { category: _c, languages: _l, ...rest } = row;
  void _c; void _l;
  const parsed = businessFormSchema.safeParse({ ...rest, categoryId, languages: langs, intent: "save" });
  if (!parsed.success) return { ok: false, message: `invalid: ${[...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(", ")}` };
  return { ok: true, input: parsed.data };
}

export async function importBusinessesCsv(csv: string, actor: { id: string }, dryRun: boolean): Promise<ImportSummary> {
  const { header, rows } = parseCsv(csv);
  if (header.length === 0) return { ok: false, error: "empty" };
  const missing = IMPORT_REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { ok: false, error: "missing_columns", detail: missing.join(", ") };
  if (rows.length === 0) return { ok: false, error: "empty" };
  if (rows.length > IMPORT_MAX_ROWS) return { ok: false, error: "too_many_rows", detail: String(IMPORT_MAX_ROWS) };

  const lk = await lookups();
  const results: RowResult[] = [];
  for (const [i, row] of rows.entries()) {
    const line = i + 2; // header is line 1
    const name = row.name ?? "";
    const done = (status: RowResult["status"], message?: string) => results.push({ line, name, status, ...(message ? { message } : {}) });

    if (!lk.city.has(key(row.city ?? ""))) { done("error", `unknown city "${row.city}" (add it under Geography first)`); continue; }
    const mapped = rowToForm(row, lk.category.get(key(row.category ?? "")));
    if (!mapped.ok) { done("error", mapped.message); continue; }
    const input = mapped.input;

    const duplicate = await prisma.business.findFirst({
      where: { deletedAt: null, name: { equals: input.name, mode: "insensitive" }, locations: { some: { addressLine1: { equals: input.addressLine1, mode: "insensitive" }, deletedAt: null } } },
      select: { id: true },
    });
    if (duplicate) { done("skipped", "already exists"); continue; }
    if (dryRun) { done("created"); continue; }

    // New cities are never created by an import (canCreateCity: false); the listing starts as draft and is then submitted.
    const saved = await saveBusiness(input, actor, { canPublish: false, canCreateCity: false });
    if (!saved.ok) { done("error", saved.error); continue; }
    await prisma.business.update({ where: { id: saved.id }, data: { status: "pending" } });
    done("created");
  }
  return {
    ok: true, dryRun,
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    rows: results,
  };
}
