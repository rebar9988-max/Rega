"use client";

/**
 * Create / edit form for a business offer. Everything is validated again on the server (saveOfferAction): this form
 * only helps the owner fill it in. An offer is a genuine discount the owner gives (none, a percentage, or an amount
 * off) between two dates; REGA never adds an "original price" or computes a percentage.
 */
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveOfferAction, type OfferFormState } from "@/app/admin/offers/actions";
import { MediaField } from "@/components/dr/MediaField";

export type OfferInitial = {
  id?: string; businessId: string; title?: string; description?: string | null; imageUrl?: string | null;
  discountType?: "none" | "percent" | "amount"; discountValue?: string | null; currency?: string | null; startDate?: string; endDate?: string;
};

const input = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand aria-[invalid=true]:border-brand";

export function OfferForm({ initial, businessName, currencies, limits, storageReady }: {
  initial: OfferInitial; businessName: string; currencies: readonly string[]; storageReady: boolean;
  limits: { titleMin: number; titleMax: number; descriptionMax: number; percentMin: number; percentMax: number };
}) {
  const t = useTranslations("offerForm");
  const [state, formAction, saving] = useActionState<OfferFormState, FormData>(saveOfferAction, undefined);
  const [, startSubmit] = useTransition();
  const [type, setType] = useState(initial.discountType ?? "none");
  const bad = (f: string) => state?.fields?.includes(f) || undefined;

  return (
    <form
      className="space-y-8"
      data-testid="offer-form"
      // Dispatch manually so a server-side validation error never resets what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startSubmit(() => formAction(data));
      }}
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="businessId" value={initial.businessId} />
      {state?.error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink" data-testid="form-error">{t(`err_${state.error}`)}</p>}

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionOffer")}</legend>
        <p className="text-sm text-muted sm:col-span-2">{t("forBusiness")} <bdi className="font-semibold text-ink">{businessName}</bdi></p>
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("title")}
          <input name="title" required minLength={limits.titleMin} maxLength={limits.titleMax} defaultValue={initial.title} className={input} aria-invalid={bad("title")} data-testid="offer-title" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("description")}
          <textarea name="description" rows={3} maxLength={limits.descriptionMax} defaultValue={initial.description ?? undefined} className={`${input} py-2`} aria-invalid={bad("description")} />
        </label>
        <div className="sm:col-span-2">
          <MediaField name="imageUrl" label={t("image")} initial={initial.imageUrl ?? ""} businessId={initial.businessId} storageReady={storageReady} invalid={Boolean(bad("imageUrl"))} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-3">
        <legend className="px-1 text-base font-bold">{t("sectionDiscount")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("discountType")}
          <select name="discountType" value={type} onChange={(e) => setType(e.target.value as typeof type)} className={input} data-testid="offer-discount-type">
            <option value="none">{t("discountNone")}</option>
            <option value="percent">{t("discountPercent")}</option>
            <option value="amount">{t("discountAmount")}</option>
          </select>
        </label>
        {type !== "none" && (
          <label className="flex flex-col gap-1 text-sm font-semibold">{type === "percent" ? t("percentValue", { min: limits.percentMin, max: limits.percentMax }) : t("amountValue")}
            <input name="discountValue" required inputMode="decimal" dir="ltr" defaultValue={initial.discountType === type ? initial.discountValue ?? undefined : undefined} className={input} aria-invalid={bad("discountValue")} data-testid="offer-discount-value" />
          </label>
        )}
        {type === "amount" && (
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("currency")}
            <select name="currency" defaultValue={initial.currency ?? currencies[0]} className={input}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        <p className="text-xs text-muted sm:col-span-3">{t("genuineNote")}</p>
      </fieldset>

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionDates")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("startDate")}
          <input name="startDate" type="date" required dir="ltr" defaultValue={initial.startDate} className={input} aria-invalid={bad("startDate")} data-testid="offer-start" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("endDate")}
          <input name="endDate" type="date" required dir="ltr" defaultValue={initial.endDate} className={input} aria-invalid={bad("endDate")} data-testid="offer-end" />
        </label>
        <p className="text-xs text-muted sm:col-span-2">{t("datesHint")}</p>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60" data-testid="offer-save">{saving ? t("saving") : t("save")}</button>
      </div>
    </form>
  );
}
