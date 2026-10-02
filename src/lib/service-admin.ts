/**
 * Admin write-side for services: validation, create/update with a unique slug per business, and status changes.
 * Server-only; callers check permissions and business access (src/lib/business-access.ts).
 */
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/api";
import { reindexBusinessTree } from "@/lib/search-index";

export const SERVICE_CURRENCIES = ["EUR", "IQD", "USD", "GBP", "CHF", "TRY"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const optionalNumber = (max: number, int = false) =>
  z.union([z.literal(""), int ? z.coerce.number().int().min(0).max(max) : z.coerce.number().min(0).max(max)]).optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v));

export const serviceFormSchema = z.object({
  id: optionalText(64),
  businessId: z.string().trim().min(1).max(64),
  categoryId: optionalText(64),
  name: z.string().trim().min(2).max(200),
  nameCkb: optionalText(200),
  nameKmr: optionalText(200),
  nameAr: optionalText(200),
  nameTr: optionalText(200),
  description: optionalText(8000),
  descriptionCkb: optionalText(8000),
  descriptionDe: optionalText(8000),
  descriptionAr: optionalText(8000),
  priceFrom: optionalNumber(9_999_999),
  priceTo: optionalNumber(9_999_999),
  currency: z.enum(SERVICE_CURRENCIES).default("EUR"),
  durationMin: optionalNumber(100_000, true),
  sortOrder: optionalNumber(100_000, true),
  intent: z.enum(["save", "publish"]).default("save"),
}).superRefine((v, ctx) => {
  if (v.priceFrom !== undefined && v.priceTo !== undefined && v.priceTo < v.priceFrom) ctx.addIssue({ code: "custom", path: ["priceTo"], message: "below priceFrom" });
});
export type ServiceForm = z.infer<typeof serviceFormSchema>;

export type ServiceSaveResult = { ok: true; id: string; published: boolean } | { ok: false; error: "not_found" | "business_not_found" | "category_not_found" };

async function uniqueSlug(businessId: string, name: string, exceptId?: string): Promise<string> {
  const base = slugify(name) || "service";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const clash = await prisma.service.findFirst({ where: { businessId, slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Creates or updates a service. With intent "publish" (and permission) it is published in the same step. */
export async function saveService(input: ServiceForm, canPublish: boolean): Promise<ServiceSaveResult> {
  const business = await prisma.business.findFirst({ where: { id: input.businessId, deletedAt: null }, select: { id: true } });
  if (!business) return { ok: false, error: "business_not_found" };
  if (input.categoryId && !(await prisma.category.findFirst({ where: { id: input.categoryId, deletedAt: null }, select: { id: true } }))) {
    return { ok: false, error: "category_not_found" };
  }
  const before = input.id ? await prisma.service.findFirst({ where: { id: input.id, deletedAt: null }, select: { id: true, businessId: true, status: true, slug: true, name: true } }) : null;
  if (input.id && !before) return { ok: false, error: "not_found" };

  const data = {
    categoryId: input.categoryId ?? null,
    name: input.name,
    nameCkb: input.nameCkb ?? null, nameKmr: input.nameKmr ?? null, nameAr: input.nameAr ?? null, nameTr: input.nameTr ?? null,
    description: input.description ?? null, descriptionCkb: input.descriptionCkb ?? null, descriptionDe: input.descriptionDe ?? null, descriptionAr: input.descriptionAr ?? null,
    priceFrom: input.priceFrom ?? null, priceTo: input.priceTo ?? null, currency: input.currency,
    durationMin: input.durationMin ?? null, sortOrder: input.sortOrder ?? 0,
  };
  const publish = input.intent === "publish" && canPublish;
  let id: string;
  let published: boolean;
  if (before) {
    // Moving a service to another business gives it a free slug there; both businesses are re-indexed.
    const slug = before.businessId !== input.businessId ? await uniqueSlug(input.businessId, input.name) : before.slug;
    const row = await prisma.service.update({
      where: { id: before.id },
      data: { ...data, businessId: input.businessId, slug, ...(publish && before.status !== "published" ? { status: "published", archivedAt: null } : {}) },
      select: { id: true, status: true },
    });
    id = row.id;
    published = row.status === "published";
    if (before.businessId !== input.businessId) await reindexBusinessTree(prisma, before.businessId);
  } else {
    const row = await prisma.service.create({
      data: { ...data, businessId: input.businessId, slug: await uniqueSlug(input.businessId, input.name), status: publish ? "published" : "draft" },
      select: { id: true, status: true },
    });
    id = row.id;
    published = row.status === "published";
  }
  await reindexBusinessTree(prisma, input.businessId);
  return { ok: true, id, published };
}

export const SERVICE_INTENTS = {
  publish: { permission: "service.publish", data: () => ({ status: "published", archivedAt: null }) },
  unpublish: { permission: "service.publish", data: () => ({ status: "draft" }) },
  archive: { permission: "service.write", data: () => ({ status: "archived", archivedAt: new Date() }) },
  restore: { permission: "service.write", data: () => ({ status: "draft", archivedAt: null }) },
  feature: { permission: "service.publish", data: () => ({ featured: true }) },
  unfeature: { permission: "service.publish", data: () => ({ featured: false }) },
} as const;
export type ServiceIntent = keyof typeof SERVICE_INTENTS;
