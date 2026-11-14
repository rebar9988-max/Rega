"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentAccount } from "@/lib/auth-helpers";
import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { allowShared } from "@/lib/rate-limit";
import { isLocale } from "@/config/locales";
import { guardForm } from "@/features/forms/guard";
import { createRequestSchema, offerSchema } from "./rules";
import { currentRequester, rememberGuestRequest } from "./guest";
import { createRequest, endRequest, markSeen, selectOffer, setRequestsEnabled, submitOffer, withdrawOffer } from "./service";

export type SmartFormState = { status: "idle" | "ok" | "error"; error?: "invalid" | "rate" | "failed" | "signin" | "unverified" | "limit" | "forbidden" | "closed" | "locked"; fields?: string[] };

const localeOf = (formData: FormData) => {
  const l = String(formData.get("locale") ?? "");
  return isLocale(l) ? l : "ckb";
};
const fieldsOf = (issues: { path: PropertyKey[] }[]) => [...new Set(issues.map((i) => String(i.path[0])))];

export async function createRequestAction(_prev: SmartFormState, formData: FormData): Promise<SmartFormState> {
  // Radar is public: a signed-in account or a guest (no account). Abuse protection is per client IP for everyone
  // (honeypot + 5 per 10 min + 10 per day), plus the open-request cap per account or per device.
  const guard = await guardForm(formData, "sr-create", 5);
  if (guard === "spam") return { status: "ok" };
  if (guard === "rate") return { status: "error", error: "rate" };
  const ip = clientIp(await headers());
  if (!(await allowShared("FORM_LIMITER", `sr-create-day:${ip}`, 10, 24 * 3_600_000))) return { status: "error", error: "rate" };
  const parsed = createRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "invalid", fields: fieldsOf(parsed.error.issues) };
  const requester = await currentRequester({ create: true }).catch(() => null);
  if (!requester) return { status: "error", error: "failed" };
  if (!requester.guest && !(await allowShared("FORM_LIMITER", `sr-create-day:${requester.actor.id}`, 10, 24 * 3_600_000))) return { status: "error", error: "rate" };
  const result = await createRequest(requester.actor, parsed.data).catch(() => null);
  if (!result) return { status: "error", error: "failed" };
  if (!result.ok) return { status: "error", error: result.error === "limit" ? "limit" : "invalid" };
  if (requester.guest) await rememberGuestRequest(requester.actor.requestIds ?? [], result.id);
  revalidatePath(`/${localeOf(formData)}/smart-request`);
  redirect(`/${localeOf(formData)}/smart-request/${result.id}`);
}

export async function submitOfferAction(_prev: SmartFormState, formData: FormData): Promise<SmartFormState> {
  const user = await currentAccount().catch(() => null);
  if (!user) return { status: "error", error: "signin" };
  const guard = await guardForm(formData, `sr-offer:${user.id}`, 20);
  if (guard === "spam") return { status: "ok" };
  if (guard === "rate") return { status: "error", error: "rate" };
  const parsed = offerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "invalid", fields: fieldsOf(parsed.error.issues) };
  const result = await submitOffer(user, parsed.data).catch(() => null);
  if (!result) return { status: "error", error: "failed" };
  if (!result.ok) return { status: "error", error: result.error === "forbidden" || result.error === "closed" || result.error === "locked" ? result.error : "failed" };
  revalidatePath(`/${localeOf(formData)}/smart-request/inbox`);
  return { status: "ok" };
}

/** Plain form actions (buttons): the signed-in account is re-read and every service call re-checks ownership. */
async function actor() {
  return currentAccount().catch(() => null);
}

/** Requester buttons (close, cancel, select): the account or the guest device, re-checked by the service. */
async function requesterActor() {
  return (await currentRequester().catch(() => null))?.actor ?? null;
}
/** Rate-limit key: the account, or the client IP for guests (who share one system owner id). */
async function limitKey(user: { id: string; requestIds?: string[] }) {
  return user.requestIds ? `guest:${clientIp(await headers())}` : user.id;
}

export async function endRequestAction(formData: FormData): Promise<void> {
  const user = await requesterActor();
  const id = String(formData.get("id") ?? "");
  const kind = formData.get("kind") === "cancelled" ? "cancelled" : "closed";
  if (user && id && (await allowShared("FORM_LIMITER", `sr-end:${await limitKey(user)}`, 30, 3_600_000))) await endRequest(user, id, kind).catch(() => null);
  revalidatePath(`/${localeOf(formData)}/smart-request`, "layout");
}

export async function selectOfferAction(formData: FormData): Promise<void> {
  const user = await requesterActor();
  const requestId = String(formData.get("requestId") ?? "");
  const offerId = String(formData.get("offerId") ?? "");
  if (user && requestId && offerId && (await allowShared("FORM_LIMITER", `sr-select:${await limitKey(user)}`, 30, 3_600_000))) await selectOffer(user, requestId, offerId).catch(() => null);
  revalidatePath(`/${localeOf(formData)}/smart-request`, "layout");
}

export async function withdrawOfferAction(formData: FormData): Promise<void> {
  const user = await actor();
  const requestId = String(formData.get("requestId") ?? "");
  const businessId = String(formData.get("businessId") ?? "");
  if (user && requestId && businessId && (await allowShared("FORM_LIMITER", `sr-withdraw:${user.id}`, 30, 3_600_000))) await withdrawOffer(user, requestId, businessId).catch(() => null);
  revalidatePath(`/${localeOf(formData)}/smart-request`, "layout");
}

export async function markSeenAction(formData: FormData): Promise<void> {
  const user = await actor();
  const id = String(formData.get("recipientId") ?? "");
  if (user && id) await markSeen(user.id, id).catch(() => null);
  revalidatePath(`/${localeOf(formData)}/smart-request/inbox`);
}

export async function togglePrefAction(formData: FormData): Promise<void> {
  const user = await actor();
  const businessId = String(formData.get("businessId") ?? "");
  if (user && businessId && (await allowShared("FORM_LIMITER", `sr-pref:${user.id}`, 30, 3_600_000))) await setRequestsEnabled(user, businessId, formData.get("enabled") === "1").catch(() => null);
  revalidatePath(`/${localeOf(formData)}/smart-request/inbox`);
}
