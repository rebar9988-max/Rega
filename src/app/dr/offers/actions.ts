"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { assertBusinessAccess } from "@/lib/business-access";
import { OFFER_ERROR_FIELDS, offerFormSchema, saveOffer, type OfferError } from "@/lib/offer-admin";

export type OfferFormState = { error?: "invalid" | OfferError; fields?: string[] } | undefined;

/** Create / edit form. Permission, business ownership and every rule run here, on the server. */
export async function saveOfferAction(_prev: OfferFormState, formData: FormData): Promise<OfferFormState> {
  const user = await requirePermission("business.write");
  const parsed = offerFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const input = parsed.data;
  await assertBusinessAccess(user, input.businessId);
  if (input.id) {
    // The offer's own business, read from the database, must also be one this person manages.
    const current = await prisma.offer.findFirst({ where: { id: input.id }, select: { businessId: true } });
    if (!current) return { error: "not_found" };
    await assertBusinessAccess(user, current.businessId);
  }
  const result = await saveOffer(input, user);
  if (!result.ok) return { error: result.error, fields: OFFER_ERROR_FIELDS[result.error] };

  await writeAudit({
    actorId: user.id, actorEmail: user.email, action: input.id ? "offer.update" : "offer.create", entity: "Offer", entityId: result.id,
    after: { businessId: result.businessId, title: input.title, discountType: input.discountType, startDate: input.startDate, endDate: input.endDate },
  });
  revalidatePath("/", "layout");
  redirect(`/dr/offers/${result.id}?saved=1`);
}

const switchSchema = z.object({ id: z.string().min(1).max(64), active: z.enum(["1", "0"]) });

/** Switch an offer on or off. An offer is never deleted: switching it off keeps the record. */
export async function setOfferActiveAction(formData: FormData): Promise<void> {
  const { id, active } = switchSchema.parse({ id: formData.get("id"), active: formData.get("active") });
  const user = await requirePermission("business.write");
  const before = await prisma.offer.findFirst({ where: { id }, select: { businessId: true, isActive: true, endsAt: true } });
  if (!before) return;
  await assertBusinessAccess(user, before.businessId);
  const isActive = active === "1";
  // Switching an offer that has already ended back on would only look like a mistake: the dates must be edited first.
  if (isActive && before.endsAt <= new Date()) redirect(`/dr/offers/${id}?ended=1`);
  await prisma.offer.update({ where: { id }, data: { isActive } });
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: isActive ? "offer.activate" : "offer.deactivate", entity: "Offer", entityId: id, before: { isActive: before.isActive }, after: { isActive } });
  revalidatePath("/", "layout");
  redirect(`/dr/offers/${id}?${isActive ? "activated" : "deactivated"}=1`);
}
