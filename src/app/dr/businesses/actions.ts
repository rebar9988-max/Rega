"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can, type Permission } from "@/lib/rbac";
import { businessFormSchema, saveBusiness } from "@/lib/business-admin";
import { geocodeAddress, type GeocodeOutcome } from "@/lib/geocoder";
import { addCreatorAsMember, assertBusinessAccess } from "@/lib/business-access";
import { reindexBusinessTree } from "@/lib/search-index";
import { getTranslations } from "next-intl/server";
import { sendEmail, teamInbox } from "@/lib/email";
import { hasConfirmedEmail } from "@/lib/email/verified";
import { approvalData, lockBusiness, publicationSelect } from "@/lib/business-publication";
import { isLocale } from "@/config/locales";

const schema = z.object({
  id: z.string().min(1).max(64),
  intent: z.enum(["publish", "unpublish", "archive", "feature", "unfeature", "verify", "unverify", "reject"]),
  // Shown to the owner in the "needs changes" e-mail (not stored beyond the audit entry).
  reason: z.string().trim().max(500).optional(),
});

const EFFECT = {
  publish: { permission: "business.publish", data: () => ({ status: "published", publishedAt: new Date(), archivedAt: null }) },
  unpublish: { permission: "business.publish", data: () => ({ status: "draft", verified: false }) },
  archive: { permission: "business.write", data: () => ({ status: "archived", archivedAt: new Date() }) },
  feature: { permission: "business.publish", data: () => ({ featured: true }) },
  unfeature: { permission: "business.publish", data: () => ({ featured: false }) },
  // Moderation: a pending listing goes back to draft so its owner can fix it and submit again.
  reject: { permission: "business.publish", data: () => ({ status: "draft", verified: false }) },
  verify: { permission: "business.publish", data: () => ({ verified: true }) },
  unverify: { permission: "business.publish", data: () => ({ verified: false, status: "draft" }) },
} as const satisfies Record<string, { permission: Permission; data: () => Record<string, unknown> }>;

/** Server action: every check runs on the server, so the UI can never grant itself a permission. */
export async function updateBusiness(formData: FormData): Promise<void> {
  const { id, intent, reason } = schema.parse({ id: formData.get("id"), intent: formData.get("intent"), reason: formData.get("reason") || undefined });
  const effect = EFFECT[intent];
  const user = await requirePermission(effect.permission);

  await assertBusinessAccess(user, id);
  const result = await prisma.$transaction(async (tx) => {
    await lockBusiness(tx, id);
    const before = await tx.business.findFirst({ where: { id, deletedAt: null }, select: { ...publicationSelect, featured: true } });
    if (!before || (intent === "reject" && before.status !== "pending")) return null;
    const approving = intent === "verify" || intent === "publish";
    const data = approving ? approvalData(before) : effect.data();
    if (!data) return { blocked: true as const, name: before.name };
    // An identical retry is a no-op, including its audit entry.
    if (Object.entries(data).every(([key, value]) => {
      const previous = before[key as keyof typeof before];
      return value instanceof Date ? previous instanceof Date && value.getTime() === previous.getTime() : previous === value;
    })) return null;
    const after = await tx.business.update({ where: { id }, data, select: { status: true, verified: true, featured: true, categoryId: true } });
    await reindexBusinessTree(tx, id);
    await tx.auditLog.create({ data: { actorId: user.id, actorEmail: user.email, action: `business.${intent}`, entity: "Business", entityId: id,
      before: { status: before.status, verified: before.verified, categoryId: before.categoryId }, after: { ...after, ...(reason ? { reason } : {}) } } });
    return { blocked: false as const, name: before.name };
  });
  if (result?.blocked) redirect(`/dr/businesses?blocked=${encodeURIComponent(id)}`);
  if (intent === "reject" && result) await notifyReturned(id, result.name, reason);
  revalidatePath("/dr", "layout");
  revalidatePath("/", "layout");
}

/** Tells the creator of a returned listing (in their own language) what to fix. Best effort: the status change already happened. */
async function notifyReturned(businessId: string, listing: string, reason?: string) {
  const row = await prisma.business.findUnique({ where: { id: businessId }, select: { createdById: true } });
  const owner = row?.createdById ? await prisma.user.findUnique({ where: { id: row.createdById }, select: { email: true, name: true, locale: true } }) : null;
  if (!owner) return;
  const locale = isLocale(owner.locale) ? owner.locale : "de";
  const t = await getTranslations({ locale, namespace: "emails" });
  const origin = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : `https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}`;
  await sendEmail({ to: owner.email, subject: t("reviewSubject"), text: t("reviewBody", { name: owner.name ?? "", listing, reason: reason ? `\n${reason}\n` : "", link: `${origin}/dr/businesses/${businessId}` }) });
}

export type BusinessFormState = {
  error?: "invalid" | "not_found" | "published_incomplete" | "city_unknown" | "unverified" | "media_invalid" | "category_invalid";
  fields?: string[];
  /** Set after a wizard "save draft": the form stays where it is and carries this id, so the next save updates the same draft. */
  draft?: { id: string; at: number };
} | undefined;

/** Create / edit form. Validation, permissions and publish rules all run here, on the server. */
export async function saveBusinessAction(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  const user = await requirePermission("business.write");
  const parsed = businessFormSchema.safeParse({ ...Object.fromEntries(formData), languages: formData.getAll("languages"), photoUrls: formData.getAll("photoUrls") });
  if (!parsed.success) return { error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const input = parsed.data;
  if (input.id) await assertBusinessAccess(user, input.id);
  const canPublish = can(user.role, "business.publish");
  // An address must be confirmed before a listing goes to moderation.
  if (input.intent === "submit" && !(await hasConfirmedEmail(user))) return { error: "unverified" };
  const result = await saveBusiness(input, user, { canPublish, canCreateCity: canPublish });
  if (!result.ok) return { error: result.error, ...(result.error === "city_unknown" ? { fields: ["city"] } : {}) };
  if (result.created || !input.id) await addCreatorAsMember(user, result.id);
  if (result.submittedNow) {
    await sendEmail({ to: teamInbox(), subject: `[REGA] New listing to review: ${input.name}`.slice(0, 200), text: `${input.name}\nSubmitted by ${user.email}\nReview: ${process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : `https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}`}/dr/businesses?status=pending` });
  }

  await writeAudit({
    actorId: user.id, actorEmail: user.email, action: result.created ? "business.create" : "business.update", entity: "Business", entityId: result.id,
    after: { name: input.name, published: result.published, locationComplete: result.missing.length === 0 },
  });
  revalidatePath("/", "layout");
  // Wizard draft: stay on the same screen (the person is in the middle of the steps) and hand back the saved id.
  if (input.intent === "draft") return { draft: { id: result.id, at: Number(formData.get("draftRevision")) || Date.now() } };
  const flag = input.intent === "publish" ? (result.published ? "published" : "blocked") : input.intent === "submit" ? (result.submitted ? "submitted" : "blocked") : "saved";
  redirect(`/dr/businesses/${result.id}?${flag}=1`);
}

const geocodeSchema = z.object({
  addressLine1: z.string().trim().min(3).max(300),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().min(1).max(120),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
});

/** Address lookup for the form's map picker (suggestions only; the admin confirms the marker). */
export async function geocodeAction(input: z.input<typeof geocodeSchema>): Promise<GeocodeOutcome> {
  await requirePermission("business.write");
  const parsed = geocodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "not_found" };
  return geocodeAddress(parsed.data);
}
