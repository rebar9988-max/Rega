"use client";

/**
 * Admin create/edit form for a service. Everything is validated again on the server (saveServiceAction).
 */
import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveServiceAction, type ServiceFormState } from "@/app/dr/services/actions";

export type ServiceInitial = {
  id?: string; businessId?: string; categoryId?: string | null; name?: string; nameCkb?: string | null; nameKmr?: string | null; nameAr?: string | null; nameTr?: string | null;
  description?: string | null; descriptionCkb?: string | null; descriptionDe?: string | null; descriptionAr?: string | null;
  priceFrom?: string | null; priceTo?: string | null; currency?: string; durationMin?: number | null; sortOrder?: number | null;
};

const input = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand aria-[invalid=true]:border-brand";

export function ServiceForm({ initial, businesses, categories, currencies, canPublish }: {
  initial: ServiceInitial; businesses: { id: string; name: string }[]; categories: { id: string; name: string }[];
  currencies: readonly string[]; canPublish: boolean;
}) {
  const t = useTranslations("svcForm");
  const tb = useTranslations("bizForm");
  const [state, formAction, saving] = useActionState<ServiceFormState, FormData>(saveServiceAction, undefined);
  const [, startSubmit] = useTransition();
  const bad = (f: string) => state?.fields?.includes(f) || undefined;
  const text = (v: string | null | undefined) => v ?? undefined;

  return (
    <form
      className="space-y-8"
      // Dispatch manually so a server-side validation error never resets what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startSubmit(() => formAction(data));
      }}
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state?.error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink" data-testid="form-error">{t(`error_${state.error}`)}</p>}

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionBasics")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("business")}
          <select name="businessId" required defaultValue={initial.businessId ?? ""} className={input} aria-invalid={bad("businessId")}>
            <option value="" disabled>{t("chooseBusiness")}</option>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{tb("category")}
          <select name="categoryId" defaultValue={initial.categoryId ?? ""} className={input} aria-invalid={bad("categoryId")}>
            <option value="">{t("noCategory")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("name")}
          <input name="name" required minLength={2} maxLength={200} defaultValue={text(initial.name)} className={input} aria-invalid={bad("name")} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("nameCkb")}
          <input name="nameCkb" maxLength={200} defaultValue={text(initial.nameCkb)} dir="rtl" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("nameKmr")}
          <input name="nameKmr" maxLength={200} defaultValue={text(initial.nameKmr)} dir="ltr" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("nameAr")}
          <input name="nameAr" maxLength={200} defaultValue={text(initial.nameAr)} dir="rtl" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("nameTr")}
          <input name="nameTr" maxLength={200} defaultValue={text(initial.nameTr)} dir="ltr" className={input} />
        </label>
      </fieldset>

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionDescription")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("description")}
          <textarea name="description" rows={3} maxLength={8000} defaultValue={text(initial.description)} className={`${input} py-2`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("descriptionCkb")}
          <textarea name="descriptionCkb" rows={3} maxLength={8000} defaultValue={text(initial.descriptionCkb)} dir="rtl" className={`${input} py-2`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("descriptionAr")}
          <textarea name="descriptionAr" rows={3} maxLength={8000} defaultValue={text(initial.descriptionAr)} dir="rtl" className={`${input} py-2`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("descriptionDe")}
          <textarea name="descriptionDe" rows={3} maxLength={8000} defaultValue={text(initial.descriptionDe)} dir="ltr" className={`${input} py-2`} />
        </label>
      </fieldset>

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-5">
        <legend className="px-1 text-base font-bold">{t("sectionPrice")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("priceFrom")}
          <input name="priceFrom" inputMode="decimal" dir="ltr" defaultValue={text(initial.priceFrom)} className={input} aria-invalid={bad("priceFrom")} data-testid="price-from" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("priceTo")}
          <input name="priceTo" inputMode="decimal" dir="ltr" defaultValue={text(initial.priceTo)} className={input} aria-invalid={bad("priceTo")} data-testid="price-to" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("currency")}
          <select name="currency" defaultValue={initial.currency ?? "EUR"} className={input}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("duration")}
          <input name="durationMin" inputMode="numeric" dir="ltr" defaultValue={initial.durationMin ?? ""} className={input} aria-invalid={bad("durationMin")} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("sortOrder")}
          <input name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={initial.sortOrder ?? ""} className={input} aria-invalid={bad("sortOrder")} />
        </label>
        <p className="text-xs text-muted sm:col-span-2 lg:col-span-5">{t("priceHint")}</p>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="save" disabled={saving} className="min-h-11 rounded-xl border border-line bg-surface px-6 text-sm font-bold hover:border-brand hover:text-brand disabled:opacity-60">{saving ? t("saving") : tb("save")}</button>
        {canPublish && (
          <button type="submit" name="intent" value="publish" disabled={saving} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{tb("savePublish")}</button>
        )}
      </div>
    </form>
  );
}
