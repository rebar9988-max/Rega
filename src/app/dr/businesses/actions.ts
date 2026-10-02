"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can, type Permission } from "@/lib/rbac";
import { businessFormSchema, readinessFor, saveBusiness } from "@/lib/business-admin";
import { geocodeAddress, type GeocodeOutcome } from "@/lib/geocoder";
import { addCreatorAsMember, assertBusinessAccess } from "@/lib/business-access";
import { reindexBusinessTree } from "@/lib/search-index";

const schema = z.object({
  id: z.string().min(1).max(64),
  intent: z.enum(["publish", "unpublish", "archive", "feature", "unfeature", "verify", "unverify"]),
});

const EFFECT = {
  publish: { permission: "business.publish", data: () => ({ status: "published", publishedAt: new Date(), archivedAt: null }) },
  unpublish: { permission: "business.publish", data: () => ({ status: "draft" }) },
  archive: { permission: "business.write", data: () => ({ status: "archived", archivedAt: new Date() }) },
  feature: { permission: "business.publish", data: () => ({ featured: true }) },
  unfeature: { permission: "business.publish", data: () => ({ featured: false }) },
  verify: { permission: "business.publish", data: () => ({ verified: true }) },
  unverify: { permission: "business.publish", data: () => ({ verified: false }) },
} as const satisfies Record<string, { permission: Permission; data: () => Record<string, unknown> }>;

/** Server action: every check runs on the server, so the UI can never grant itself a permission. */
export async function updateBusiness(formData: FormData): Promise<void> {
  const { id, intent } = schema.parse({ id: formData.get("id"), intent: formData.get("intent") });
  const effect = EFFECT[intent];
  const user = await requirePermission(effect.permission);

  const before = await prisma.business.findFirst({ where: { id, deletedAt: null }, select: { status: true, featured: true, verified: true, name: true } });
  if (!before) return;
  await assertBusinessAccess(user, id);
  // Only complete businesses with a confirmed location can go live (and onto the map / Nearby).
  if (intent === "publish" && !(await readinessFor(id)).ok) redirect(`/dr/businesses?blocked=${encodeURIComponent(id)}`);
  const after = await prisma.business.update({ where: { id }, data: effect.data(), select: { status: true, featured: true, verified: true } });
  await reindexBusinessTree(prisma, id);

  await writeAudit({ actorId: user.id, actorEmail: user.email, action: `business.${intent}`, entity: "Business", entityId: id, before, after });
  revalidatePath("/dr", "layout");
}

export type BusinessFormState = { error?: "invalid" | "not_found" | "published_incomplete"; fields?: string[] } | undefined;

/** Create / edit form. Validation, permissions and publish rules all run here, on the server. */
export async function saveBusinessAction(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  const user = await requirePermission("business.write");
  const parsed = businessFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const input = parsed.data;
  if (input.id) await assertBusinessAccess(user, input.id);
  const result = await saveBusiness(input, user, can(user.role, "business.publish"));
  if (!result.ok) return { error: result.error };
  if (!input.id) await addCreatorAsMember(user, result.id);

  await writeAudit({
    actorId: user.id, actorEmail: user.email, action: input.id ? "business.update" : "business.create", entity: "Business", entityId: result.id,
    after: { name: input.name, published: result.published, locationComplete: result.missing.length === 0 },
  });
  revalidatePath("/", "layout");
  const flag = input.intent === "publish" ? (result.published ? "published" : "blocked") : "saved";
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
