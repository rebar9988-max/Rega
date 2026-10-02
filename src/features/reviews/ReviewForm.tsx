"use client";

import { Fragment, useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { IDLE } from "@/features/forms/state";
import { Honeypot } from "@/features/forms/Honeypot";
import { MAX_COMMENT } from "./rating";
import { submitReview, type ReviewFormState } from "./actions";

const STAR = "m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8L12 3Z";

export function ReviewForm({ businessId, initial }: { businessId: string; initial?: { rating: number; comment: string | null; status: string } | null }) {
  const t = useTranslations("reviews");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(submitReview, IDLE);
  if (state.status === "ok") return <p role="status" data-testid="review-sent" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t("thanks")}</p>;
  const error = state.status === "error" ? ({ rate: tf("rateLimited"), invalid: tf("invalid"), signin: t("signIn"), own: t("own"), unverified: t("unverified"), disabled: t("disabled"), failed: tf("failed") } as Record<string, string>)[state.error ?? "failed"] : null;
  return (
    <form action={action} data-testid="review-form" className="relative space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <input type="hidden" name="businessId" value={businessId} /><input type="hidden" name="locale" value={locale} />
      <Honeypot label={tf("leaveEmpty")} />
      {initial && <p className="text-xs text-muted">{initial.status === "pending" ? t("yoursPending") : t("yoursReplace")}</p>}
      {error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-2 text-sm font-semibold">{error}</p>}
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">{t("yourRating")}</legend>
        {/* Stars are written 5..1 and laid out in reverse, so "checked" and "after the checked star" colour the stars to its left. */}
        <div className="flex flex-row-reverse justify-end gap-1" dir="ltr">
          {[5, 4, 3, 2, 1].map((n) => (
            <Fragment key={n}>
              <input id={`rating-${n}`} type="radio" name="rating" value={n} required defaultChecked={initial?.rating === n} className="peer sr-only" aria-label={t("stars", { count: n })} />
              <label htmlFor={`rating-${n}`} aria-hidden="true" className="cursor-pointer text-line hover:text-sun peer-checked:text-sun [&:hover~label]:text-sun">
                <svg viewBox="0 0 24 24" className="size-8" fill="currentColor"><path d={STAR} /></svg>
              </label>
            </Fragment>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("yourComment")}
        <textarea name="comment" rows={3} maxLength={MAX_COMMENT} defaultValue={initial?.comment ?? ""} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-normal outline-none focus:border-brand" />
      </label>
      <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("submit")}</button>
    </form>
  );
}
