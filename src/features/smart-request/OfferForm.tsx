"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Honeypot } from "@/features/forms/Honeypot";
import { submitOfferAction, withdrawOfferAction, type SmartFormState } from "./actions";
import { AVAILABILITY, formatEuro } from "./rules";

const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";
const IDLE: SmartFormState = { status: "idle" };
const AV_KEY = { now: "avNow", today: "avToday", tomorrow: "avTomorrow", thisWeek: "avThisWeek", onRequest: "avOnRequest" } as const;
const ERROR_KEY = { invalid: "errInvalid", rate: "errRate", failed: "errFailed", signin: "errSignin", unverified: "errUnverified", limit: "errLimit", forbidden: "errForbidden", closed: "errClosed", locked: "errLocked" } as const;

export type ExistingOffer = { priceCents: number; availability: string; message: string | null; status: string } | null;

/** One business's offer on one request: send, update or withdraw. Selected/rejected offers are read-only. */
export function OfferForm({ requestId, businessId, offer }: { requestId: string; businessId: string; offer: ExistingOffer }) {
  const t = useTranslations("smartRequest");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [state, action, pending] = useActionState(submitOfferAction, IDLE);
  const bad = (name: string) => state.fields?.includes(name) || undefined;
  const locked = offer?.status === "selected" || offer?.status === "rejected";

  if (locked && offer) {
    return <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{offer.status === "selected" ? t("selected") : t("statusClosed")} · {formatEuro(offer.priceCents)}</p>;
  }
  const active = offer?.status === "active";
  return (
    <div className="grid gap-3">
      <form action={action} className="relative grid gap-3 sm:grid-cols-2" data-testid="offer-form">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="businessId" value={businessId} />
        <Honeypot label={tf("leaveEmpty")} />
        {state.status === "error" && state.error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold sm:col-span-2">{t(ERROR_KEY[state.error])}</p>}
        {state.status === "ok" && <p role="status" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold sm:col-span-2">{t("offerSent")}</p>}
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("priceLabel")}
          <input name="price" inputMode="decimal" required dir="ltr" defaultValue={active && offer ? (offer.priceCents / 100).toFixed(2) : ""} aria-invalid={bad("price")} className={`${field} text-start`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("availability")}
          <select name="availability" defaultValue={active && offer ? offer.availability : "today"} className={field}>
            {AVAILABILITY.map((a) => <option key={a} value={a}>{t(AV_KEY[a])}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("messageLabel")}
          <textarea name="message" rows={2} maxLength={500} defaultValue={active && offer?.message ? offer.message : ""} aria-invalid={bad("message")} className={`${field} py-2`} />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{active ? t("updateOffer") : t("sendOffer")}</button>
        </div>
      </form>
      {active && (
        <form action={withdrawOfferAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="businessId" value={businessId} />
          <button type="submit" className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:border-brand">{t("withdrawOffer")}</button>
        </form>
      )}
    </div>
  );
}
