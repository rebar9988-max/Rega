import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { writeAudit } from "@/lib/audit";
import { PUBLIC_BUSINESS } from "@/lib/search-where";
import { getCategories, nearbyBusinesses } from "@/lib/data";
import type { Role } from "@/lib/rbac";
import { MAX_OPEN_REQUESTS, MAX_RECIPIENTS, expiryFrom, isActionable, roundCoord, type CreateRequestInput, type OfferInput } from "./rules";

export type Actor = { id: string; email: string; role: Role };
export type ServiceResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: "invalid" | "forbidden" | "notfound" | "closed" | "limit" | "locked" };

const BUSINESS_PUBLIC = { id: true, slug: true, name: true, nameCkb: true, nameKmr: true, nameAr: true, nameTr: true, logoUrl: true, verified: true, ratingAvg: true, ratingCount: true } as const;

/** Creates a request and notifies (inbox rows) the matching businesses: published, category, distance, not opted out. */
export async function createRequest(actor: Actor, input: CreateRequestInput): Promise<ServiceResult<{ id: string; matched: number }>> {
  const now = new Date();
  const categories = await getCategories();
  if (!categories.some((c) => c.id === input.categoryId)) return { ok: false, error: "invalid" };

  let lat = input.lat;
  let lng = input.lng;
  if (input.cityId) {
    const city = await prisma.city.findFirst({ where: { id: input.cityId, isActive: true, latitude: { not: null }, longitude: { not: null } }, select: { latitude: true, longitude: true } });
    if (!city || city.latitude === null || city.longitude === null) return { ok: false, error: "invalid" };
    lat = city.latitude;
    lng = city.longitude;
  }
  if (lat === undefined || lng === undefined) return { ok: false, error: "invalid" };
  lat = roundCoord(lat);
  lng = roundCoord(lng);

  const open = await prisma.smartRequest.count({ where: { userId: actor.id, status: "open", expiresAt: { gt: now } } });
  if (open >= MAX_OPEN_REQUESTS) return { ok: false, error: "limit" };

  // Double submit: the same request again within ten minutes returns the first one.
  const twin = await prisma.smartRequest.findFirst({
    where: { userId: actor.id, categoryId: input.categoryId, title: input.title, createdAt: { gte: new Date(now.getTime() - 600_000) } },
    select: { id: true, matchedCount: true },
  });
  if (twin) return { ok: true, id: twin.id, matched: twin.matchedCount };

  const found = await nearbyBusinesses({ lat, lng, radiusKm: input.radiusKm, category: input.categoryId, openNow: false, sort: "distance", page: 1, mode: "map" });
  const candidates = found.items.map((i) => ({ businessId: i.business.id, distanceKm: i.distanceKm }));
  const ids = candidates.map((c) => c.businessId);
  const [optedOut, own] = ids.length
    ? await Promise.all([
        prisma.smartRequestPref.findMany({ where: { businessId: { in: ids }, enabled: false }, select: { businessId: true } }),
        prisma.businessMember.findMany({ where: { userId: actor.id, businessId: { in: ids } }, select: { businessId: true } }),
      ])
    : [[], []];
  const skip = new Set([...optedOut, ...own].map((r) => r.businessId));
  const recipients = candidates.filter((c) => !skip.has(c.businessId)).slice(0, MAX_RECIPIENTS);

  const request = await prisma.smartRequest.create({
    data: {
      userId: actor.id, categoryId: input.categoryId, title: input.title, description: input.description || null, cityId: input.cityId ?? null,
      latitude: lat, longitude: lng, radiusKm: input.radiusKm, matchedCount: recipients.length, expiresAt: expiryFrom(now), locale: input.locale,
    },
    select: { id: true },
  });
  // D1 binds at most 100 values per statement: insert the inbox rows in small batches.
  for (let i = 0; i < recipients.length; i += 10) {
    try {
      await prisma.smartRequestRecipient.createMany({ data: recipients.slice(i, i + 10).map((r) => ({ requestId: request.id, businessId: r.businessId, distanceKm: r.distanceKm })) });
    } catch (error) {
      log.error("smartrequest.recipients.failed", { requestId: request.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "smartrequest.create", entity: "SmartRequest", entityId: request.id, after: { categoryId: input.categoryId, radiusKm: input.radiusKm, matched: recipients.length } });
  return { ok: true, id: request.id, matched: recipients.length };
}

export async function listMyRequests(userId: string) {
  const rows = await prisma.smartRequest.findMany({
    where: { userId }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, title: true, categoryId: true, status: true, matchedCount: true, expiresAt: true, createdAt: true, offersSeenAt: true },
  });
  if (!rows.length) return [];
  const offers = await prisma.smartOffer.findMany({ where: { requestId: { in: rows.map((r) => r.id) }, status: { in: ["active", "selected"] } }, select: { requestId: true, updatedAt: true } });
  return rows.map((r) => {
    const mine = offers.filter((o) => o.requestId === r.id);
    return { ...r, offerCount: mine.length, newOffers: mine.filter((o) => !r.offersSeenAt || o.updatedAt > r.offersSeenAt).length };
  });
}

/** The requester's own request with its offers (cheapest first). Contact details are returned for the selected offer only. */
export async function getMyRequest(userId: string, id: string) {
  const request = await prisma.smartRequest.findFirst({
    where: { id, userId },
    select: { id: true, title: true, description: true, categoryId: true, status: true, radiusKm: true, matchedCount: true, expiresAt: true, createdAt: true, selectedOfferId: true, offersSeenAt: true, cityId: true },
  });
  if (!request) return null;
  const offers = await prisma.smartOffer.findMany({
    where: { requestId: id, status: { in: ["active", "selected"] } }, orderBy: { priceCents: "asc" },
    select: { id: true, businessId: true, priceCents: true, currency: true, availability: true, message: true, status: true, updatedAt: true },
  });
  const ids = offers.map((o) => o.businessId);
  const [businesses, recipients] = ids.length
    ? await Promise.all([
        prisma.business.findMany({ where: { id: { in: ids }, ...PUBLIC_BUSINESS }, select: { ...BUSINESS_PUBLIC, phone: true, whatsapp: true } }),
        prisma.smartRequestRecipient.findMany({ where: { requestId: id, businessId: { in: ids } }, select: { businessId: true, distanceKm: true } }),
      ])
    : [[], []];
  const items = offers.flatMap((o) => {
    const b = businesses.find((x) => x.id === o.businessId);
    if (!b) return [];
    const { phone, whatsapp, ...business } = b;
    const selected = o.status === "selected";
    return [{ ...o, business, distanceKm: recipients.find((r) => r.businessId === o.businessId)?.distanceKm ?? null, contact: selected ? { phone, whatsapp } : null }];
  });
  return { request, offers: items };
}

export async function markOffersSeen(userId: string, id: string): Promise<void> {
  await prisma.smartRequest.updateMany({ where: { id, userId }, data: { offersSeenAt: new Date() } });
}

async function ownOpenRequest(userId: string, id: string) {
  const row = await prisma.smartRequest.findFirst({ where: { id, userId }, select: { id: true, status: true, expiresAt: true } });
  if (!row) return { error: "notfound" as const };
  return isActionable(row) ? { row } : { error: "closed" as const };
}

export async function endRequest(actor: Actor, id: string, kind: "closed" | "cancelled"): Promise<ServiceResult> {
  const own = await ownOpenRequest(actor.id, id);
  if ("error" in own && own.error) return { ok: false, error: own.error };
  await prisma.smartRequest.updateMany({ where: { id, userId: actor.id, status: "open" }, data: { status: kind, closedAt: new Date() } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: kind === "closed" ? "smartrequest.close" : "smartrequest.cancel", entity: "SmartRequest", entityId: id });
  return { ok: true };
}

export async function selectOffer(actor: Actor, requestId: string, offerId: string): Promise<ServiceResult> {
  const own = await ownOpenRequest(actor.id, requestId);
  if ("error" in own && own.error) return { ok: false, error: own.error };
  const offer = await prisma.smartOffer.findFirst({ where: { id: offerId, requestId, status: "active" }, select: { id: true, businessId: true } });
  if (!offer) return { ok: false, error: "notfound" };
  await prisma.smartOffer.updateMany({ where: { id: offer.id, requestId, status: "active" }, data: { status: "selected" } });
  await prisma.smartOffer.updateMany({ where: { requestId, status: "active" }, data: { status: "rejected" } });
  await prisma.smartRequest.updateMany({ where: { id: requestId, userId: actor.id, status: "open" }, data: { status: "closed", closedAt: new Date(), selectedOfferId: offer.id } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "smartrequest.select_offer", entity: "SmartRequest", entityId: requestId, after: { offerId: offer.id, businessId: offer.businessId } });
  return { ok: true };
}

/** Businesses the user is an active member of (published only): the only businesses the user may act for. */
async function memberBusinesses(userId: string) {
  const rows = await prisma.businessMember.findMany({ where: { userId, isActive: true, business: PUBLIC_BUSINESS }, select: { business: { select: BUSINESS_PUBLIC } } });
  return rows.map((r) => r.business);
}

/** The business inbox: requests matched to the user's businesses, with their own offers. No requester data, no coordinates. */
export async function businessInbox(userId: string) {
  const businesses = await memberBusinesses(userId);
  if (!businesses.length) return { businesses: [], items: [] };
  const ids = businesses.map((b) => b.id);
  const recipients = await prisma.smartRequestRecipient.findMany({ where: { businessId: { in: ids } }, orderBy: { notifiedAt: "desc" }, take: 60, select: { id: true, requestId: true, businessId: true, distanceKm: true, status: true, notifiedAt: true } });
  const requestIds = [...new Set(recipients.map((r) => r.requestId))];
  const [requests, offers, prefs] = await Promise.all([
    requestIds.length ? prisma.smartRequest.findMany({ where: { id: { in: requestIds } }, select: { id: true, title: true, description: true, categoryId: true, status: true, expiresAt: true, createdAt: true } }) : [],
    requestIds.length ? prisma.smartOffer.findMany({ where: { requestId: { in: requestIds }, businessId: { in: ids } }, select: { id: true, requestId: true, businessId: true, priceCents: true, availability: true, message: true, status: true } }) : [],
    prisma.smartRequestPref.findMany({ where: { businessId: { in: ids } }, select: { businessId: true, enabled: true } }),
  ]);
  const items = recipients.flatMap((r) => {
    const request = requests.find((q) => q.id === r.requestId);
    if (!request) return [];
    return [{ recipientId: r.id, businessId: r.businessId, distanceKm: r.distanceKm, seen: r.status !== "new", request, offer: offers.find((o) => o.requestId === r.requestId && o.businessId === r.businessId) ?? null }];
  });
  return { businesses: businesses.map((b) => ({ ...b, enabled: prefs.find((p) => p.businessId === b.id)?.enabled !== false })), items };
}

export async function markSeen(userId: string, recipientId: string): Promise<void> {
  const ids = (await memberBusinesses(userId)).map((b) => b.id);
  if (!ids.length) return;
  await prisma.smartRequestRecipient.updateMany({ where: { id: recipientId, businessId: { in: ids }, status: "new" }, data: { status: "seen", seenAt: new Date() } });
}

/** Submit or update the business's single offer on a request it was matched to. */
export async function submitOffer(actor: Actor, input: OfferInput): Promise<ServiceResult> {
  const member = await prisma.businessMember.findFirst({ where: { userId: actor.id, businessId: input.businessId, isActive: true, business: PUBLIC_BUSINESS }, select: { id: true } });
  if (!member) return { ok: false, error: "forbidden" };
  const recipient = await prisma.smartRequestRecipient.findUnique({ where: { requestId_businessId: { requestId: input.requestId, businessId: input.businessId } }, select: { id: true } });
  if (!recipient) return { ok: false, error: "forbidden" };
  const request = await prisma.smartRequest.findUnique({ where: { id: input.requestId }, select: { id: true, status: true, expiresAt: true } });
  if (!request) return { ok: false, error: "notfound" };
  if (!isActionable(request)) return { ok: false, error: "closed" };
  const existing = await prisma.smartOffer.findUnique({ where: { requestId_businessId: { requestId: input.requestId, businessId: input.businessId } }, select: { id: true, status: true } });
  if (existing && (existing.status === "selected" || existing.status === "rejected")) return { ok: false, error: "locked" };
  const data = { priceCents: input.price, availability: input.availability, message: input.message || null, status: "active" };
  await prisma.smartOffer.upsert({
    where: { requestId_businessId: { requestId: input.requestId, businessId: input.businessId } },
    create: { requestId: input.requestId, businessId: input.businessId, ...data },
    update: data,
  });
  await prisma.smartRequestRecipient.updateMany({ where: { id: recipient.id }, data: { status: "offered", seenAt: new Date() } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: existing ? "smartoffer.update" : "smartoffer.create", entity: "SmartOffer", entityId: existing?.id ?? null, after: { requestId: input.requestId, businessId: input.businessId, priceCents: input.price } });
  return { ok: true };
}

export async function withdrawOffer(actor: Actor, requestId: string, businessId: string): Promise<ServiceResult> {
  const member = await prisma.businessMember.findFirst({ where: { userId: actor.id, businessId, isActive: true, business: PUBLIC_BUSINESS }, select: { id: true } });
  if (!member) return { ok: false, error: "forbidden" };
  const offer = await prisma.smartOffer.findUnique({ where: { requestId_businessId: { requestId, businessId } }, select: { id: true, status: true } });
  if (!offer) return { ok: false, error: "notfound" };
  if (offer.status !== "active") return { ok: false, error: "locked" };
  await prisma.smartOffer.updateMany({ where: { id: offer.id, status: "active" }, data: { status: "withdrawn" } });
  await prisma.smartRequestRecipient.updateMany({ where: { requestId, businessId }, data: { status: "seen" } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "smartoffer.withdraw", entity: "SmartOffer", entityId: offer.id });
  return { ok: true };
}

export async function setRequestsEnabled(actor: Actor, businessId: string, enabled: boolean): Promise<ServiceResult> {
  const member = await prisma.businessMember.findFirst({ where: { userId: actor.id, businessId, isActive: true, business: PUBLIC_BUSINESS }, select: { id: true } });
  if (!member) return { ok: false, error: "forbidden" };
  await prisma.smartRequestPref.upsert({ where: { businessId }, create: { businessId, enabled }, update: { enabled } });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "smartrequest.pref", entity: "SmartRequestPref", entityId: businessId, after: { enabled } });
  return { ok: true };
}
