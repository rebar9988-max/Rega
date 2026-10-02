/**
 * Admin write-side for categories. Categories are never deleted: businesses and services reference them, so
 * "remove" means deactivate (hidden from the public site and the forms, restorable, links keep working).
 */
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeBasic } from "@/lib/text";
import { businessesInCategory, reindexBusinessTree } from "@/lib/search-index";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const categoryFormSchema = z.object({
  id: z.string().trim().max(64).optional().transform((v) => v || undefined),
  nameCkb: z.string().trim().min(1).max(200),
  nameDe: z.string().trim().min(1).max(200),
  nameKmr: optionalText(200),
  nameEn: optionalText(200),
  nameAr: optionalText(200),
  nameFa: optionalText(200),
  nameTr: optionalText(200),
  parentId: z.string().trim().max(64).optional().transform((v) => v || null),
  sortOrder: z.union([z.literal(""), z.coerce.number().int().min(0).max(10_000)]).optional().transform((v) => (v === "" || v === undefined ? 0 : v)),
});
export type CategoryForm = z.infer<typeof categoryFormSchema>;

/** Stable ASCII key/slug from the German or English name; unique among existing categories. */
async function uniqueKey(source: string): Promise<string> {
  const base = normalizeBasic(source).replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "category";
  let key = base;
  for (let i = 2; i < 100; i++) {
    if (!(await prisma.category.findFirst({ where: { OR: [{ key }, { slug: key }] }, select: { id: true } }))) return key;
    key = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export type CategorySaveResult = { ok: true; id: string } | { ok: false; error: "not_found" | "parent_invalid" };

export async function saveCategory(input: CategoryForm): Promise<CategorySaveResult> {
  const before = input.id ? await prisma.category.findFirst({ where: { id: input.id, deletedAt: null }, select: { id: true } }) : null;
  if (input.id && !before) return { ok: false, error: "not_found" };
  if (input.parentId) {
    // One level of nesting, as on the public site: a parent must itself be a top-level category, and not this one.
    const parent = await prisma.category.findFirst({ where: { id: input.parentId, deletedAt: null, parentId: null }, select: { id: true } });
    if (!parent || parent.id === input.id) return { ok: false, error: "parent_invalid" };
    if (input.id && (await prisma.category.count({ where: { parentId: input.id, deletedAt: null } })) > 0) return { ok: false, error: "parent_invalid" };
  }
  const data = {
    nameCkb: input.nameCkb, nameDe: input.nameDe, nameKmr: input.nameKmr, nameEn: input.nameEn, nameAr: input.nameAr, nameFa: input.nameFa, nameTr: input.nameTr,
    parentId: input.parentId, sortOrder: input.sortOrder,
  };
  let id: string;
  if (before) {
    id = (await prisma.category.update({ where: { id: before.id }, data, select: { id: true } })).id;
    // Names are part of the search index of every business and service in this category.
    for (const businessId of await businessesInCategory(prisma, id)) await reindexBusinessTree(prisma, businessId);
  } else {
    const key = await uniqueKey(input.nameEn || input.nameDe);
    id = (await prisma.category.create({ data: { ...data, key, slug: key, isActive: true }, select: { id: true } })).id;
  }
  return { ok: true, id };
}
