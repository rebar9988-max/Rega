"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { canManageBusiness, hasGlobalBusinessAccess } from "@/lib/business-access";
import { emailEnabled, sendEmail, teamInbox } from "@/lib/email";
import { sectionEnabled } from "@/config/sections";
import { composeSearchText } from "@/lib/search-index";
import { CONTENT, isContentSection, type ContentSection } from "./config";
import { SCHEMAS, listingSlugBase, readTranslations, translationsOk } from "./pure";


export type EntryFormState = { error?: "invalid" | "forbidden" | "unverified" | "business" | "disabled"; fields?: string[] } | undefined;

const nameSel = { nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true } as const;
/** The text values of a row (names in every language), without ids. */
const texts = (row: Record<string, unknown> | null) => Object.entries(row ?? {}).flatMap(([k, v]) => (k !== "id" && typeof v === "string" ? [v] : []));
const origin = () => (process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : `https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}`);

/** Create / edit an entry of a content section (jobs, events, guides). Validation, scoping and publish rules run here. */
export async function saveEntryAction(_prev: EntryFormState, formData: FormData): Promise<EntryFormState> {
  const section = String(formData.get("section") ?? "");
  if (!isContentSection(section)) return { error: "invalid" };
  if (!sectionEnabled(section)) return { error: "disabled" };
  const config = CONTENT[section];
  const user = await requirePermission(config.write);

  const raw = { ...Object.fromEntries(formData), languages: formData.getAll("languages") };
  const parsed = SCHEMAS[section].safeParse(raw);
  if (!parsed.success) return { error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const input = parsed.data as z.infer<(typeof SCHEMAS)[ContentSection]> & { intent: "save" | "publish" | "submit"; id?: string; businessId?: string; cityId?: string; categoryId?: string };
  const translations = readTranslations(raw);
  if (!translationsOk(section, translations)) return { error: "invalid", fields: ["title"] };

  // Scoping: owners work only with businesses they manage and entries of those (or their own); staff with global access manage all.
  const global = hasGlobalBusinessAccess(user.role);
  if (input.businessId && !global && !(await canManageBusiness(user, input.businessId))) return { error: "forbidden" };
  if (config.requiresBusiness && !input.businessId) return { error: "business", fields: ["businessId"] };
  const existing = input.id ? await prisma.listing.findFirst({ where: { id: input.id, sectionKey: section, deletedAt: null }, select: { id: true, status: true, createdById: true, businessId: true, publishedAt: true } }) : null;
  if (input.id && !existing) return { error: "invalid" };
  if (existing && !global && existing.createdById !== user.id && !(existing.businessId && (await canManageBusiness(user, existing.businessId)))) return { error: "forbidden" };

  const canPublish = can(user.role, config.publish);
  const wantsPublish = input.intent === "publish" && canPublish;
  const wantsSubmit = input.intent === "submit" || (input.intent === "publish" && !canPublish);
  if (wantsSubmit && emailEnabled()) {
    const row = await prisma.user.findFirst({ where: { id: user.id, deletedAt: null }, select: { emailVerified: true } });
    if (!row?.emailVerified) return { error: "unverified" };
  }

  const [city, category, business] = await Promise.all([
    input.cityId ? prisma.city.findFirst({ where: { id: input.cityId, isActive: true }, select: { id: true, ...nameSel } }) : null,
    input.categoryId ? prisma.category.findFirst({ where: { id: input.categoryId, isActive: true, deletedAt: null, sectionKey: section }, select: { id: true, ...nameSel } }) : null,
    input.businessId ? prisma.business.findFirst({ where: { id: input.businessId, deletedAt: null }, select: { id: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true } }) : null,
  ]);
  if ((input.cityId && !city) || (input.categoryId && !category) || (input.businessId && !business)) return { error: "invalid" };

  const status = wantsPublish ? "published" : wantsSubmit ? (existing?.status === "published" ? "published" : "pending") : existing?.status ?? "draft";
  const searchText = composeSearchText([...translations.flatMap((t) => [t.title, t.summary]), ...texts(business), ...texts(city), ...texts(category)]);
  const shared = { businessId: business?.id ?? null, cityId: city?.id ?? null, categoryId: category?.id ?? null, status, searchText, ...(status === "published" && !existing?.publishedAt ? { publishedAt: new Date() } : {}) };
  const jobs = section === "jobs" ? (parsed.data as { expiresAt?: Date }) : null;

  const entryId = await prisma.$transaction(async (tx) => {
    let id = existing?.id;
    if (id) {
      await tx.listing.update({ where: { id }, data: { ...shared, expiresAt: jobs?.expiresAt ?? null } });
    } else {
      const base = listingSlugBase(Object.fromEntries(translations.map((t) => [t.locale, t.title])));
      let slug = base;
      if (await tx.listing.findUnique({ where: { sectionKey_slug: { sectionKey: section, slug } }, select: { id: true } })) slug = `${base}-${Date.now().toString(36)}`;
      id = (await tx.listing.create({ data: { sectionKey: section, slug, createdById: user.id, ...shared, expiresAt: jobs?.expiresAt ?? null } })).id;
    }
    await tx.listingTranslation.deleteMany({ where: { listingId: id, locale: { notIn: translations.map((t) => t.locale) } } });
    for (const t of translations) {
      await tx.listingTranslation.upsert({ where: { listingId_locale: { listingId: id, locale: t.locale } }, update: { title: t.title, summary: t.summary ?? null, body: t.body ?? null }, create: { listingId: id, locale: t.locale, title: t.title, summary: t.summary ?? null, body: t.body ?? null } });
    }
    if (section === "jobs") {
      const j = parsed.data as { employmentType: string; applyUrl?: string; applyEmail?: string; languages: string[] };
      const data = { employmentType: j.employmentType, applyUrl: j.applyUrl ?? null, applyEmail: j.applyEmail ?? null, languages: j.languages };
      await tx.jobDetails.upsert({ where: { listingId: id }, update: data, create: { listingId: id, ...data } });
    } else if (section === "events") {
      const e = parsed.data as { startsAt: Date; endsAt?: Date; venue?: string; infoUrl?: string };
      const data = { startsAt: e.startsAt, endsAt: e.endsAt ?? null, venue: e.venue ?? null, infoUrl: e.infoUrl ?? null };
      await tx.eventDetails.upsert({ where: { listingId: id }, update: data, create: { listingId: id, ...data } });
    } else {
      const g = parsed.data as { readMinutes?: number };
      await tx.guideDetails.upsert({ where: { listingId: id }, update: { readMinutes: g.readMinutes ?? null }, create: { listingId: id, readMinutes: g.readMinutes ?? null } });
    }
    return id;
  });

  await writeAudit({ actorId: user.id, actorEmail: user.email, action: `${section}.${existing ? "update" : "create"}`, entity: "Listing", entityId: entryId, after: { status } });
  if (wantsSubmit && existing?.status !== "pending" && status === "pending") {
    await sendEmail({ to: teamInbox(), subject: `[REGA] New ${section} entry to review: ${translations[0].title}`.slice(0, 200), text: `${translations[0].title}\nSubmitted by ${user.email}\nReview: ${origin()}/dr/content/${section}?status=pending` });
  }
  revalidatePath("/", "layout");
  redirect(`/dr/content/${section}/${entryId}?${status === "published" && wantsPublish ? "published" : status === "pending" ? "submitted" : "saved"}=1`);
}

const moderationSchema = z.object({ id: z.string().min(1).max(64), section: z.string().refine(isContentSection), intent: z.enum(["publish", "reject", "archive", "restore", "verify", "unverify"]), reason: z.string().trim().max(500).optional() });

/** Moderation of an entry from the dashboard list: publish, return to draft, archive / restore, verify. */
export async function moderateEntry(formData: FormData): Promise<void> {
  const parsed = moderationSchema.parse({ id: formData.get("id"), section: formData.get("section"), intent: formData.get("intent"), reason: formData.get("reason") || undefined });
  const section = parsed.section as ContentSection;
  const config = CONTENT[section];
  const user = await requirePermission(config.publish);
  const before = await prisma.listing.findFirst({ where: { id: parsed.id, sectionKey: section, deletedAt: null }, select: { status: true, publishedAt: true, verified: true } });
  if (!before) return;
  const data = {
    publish: { status: "published", publishedAt: before.publishedAt ?? new Date() },
    reject: { status: "draft" },
    archive: { status: "archived" },
    restore: { status: "draft" },
    verify: { verified: true },
    unverify: { verified: false },
  }[parsed.intent];
  if (parsed.intent === "reject" && before.status !== "pending") return;
  await prisma.listing.update({ where: { id: parsed.id }, data });
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: `${section}.${parsed.intent}`, entity: "Listing", entityId: parsed.id, before, after: { ...data, ...(parsed.reason ? { reason: parsed.reason } : {}) } });
  revalidatePath("/", "layout");
}
