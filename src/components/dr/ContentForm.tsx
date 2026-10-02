"use client";

/**
 * Create/edit form of a content entry (job, event, guide). One component for all three sections: the shared fields
 * (business, city, category, texts per language) plus the section's own details. Everything is validated again on
 * the server (saveEntryAction); this component only helps to fill it in correctly.
 */
import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { LOCALES, LOCALE_META, localeSuffix, type Locale } from "@/config/locales";
import { saveEntryAction, type EntryFormState } from "@/features/content/actions";
import { EMPLOYMENT_TYPES, type ContentSection } from "@/features/content/config";

export type EntryInitial = {
  id?: string;
  status?: string;
  businessId?: string;
  cityId?: string;
  categoryId?: string;
  texts?: Partial<Record<Locale, { title: string; summary?: string; body?: string }>>;
  employmentType?: string;
  applyUrl?: string;
  applyEmail?: string;
  expiresAt?: string;
  languages?: string[];
  startsAt?: string;
  endsAt?: string;
  venue?: string;
  infoUrl?: string;
  readMinutes?: number;
};

type Option = { id: string; name: string };

const input = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand aria-[invalid=true]:border-brand";

export function ContentForm({ section, initial, businesses, cities, categories, requiresBusiness, canPublish }: {
  section: ContentSection; initial: EntryInitial; businesses: Option[]; cities: Option[]; categories: Option[]; requiresBusiness: boolean; canPublish: boolean;
}) {
  const t = useTranslations("content");
  const [state, formAction, saving] = useActionState<EntryFormState, FormData>(saveEntryAction, undefined);
  const [, startSubmit] = useTransition();
  const bad = (f: string) => state?.fields?.includes(f) || undefined;
  const locked = initial.status === "pending";
  const kind = ({ jobs: "kindJobs", events: "kindEvents", guides: "kindGuides" } as const)[section];

  return (
    <form
      className="space-y-8"
      // Dispatch manually (not via the action prop) so a server-side validation error never resets what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startSubmit(() => formAction(data));
      }}
    >
      <input type="hidden" name="section" value={section} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state?.error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink" data-testid="form-error">{t(`error_${state.error}`)}</p>}

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-3">
        <legend className="px-1 text-base font-bold">{t(kind)}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("business")}
          <select name="businessId" required={requiresBusiness} defaultValue={initial.businessId ?? ""} className={input} aria-invalid={bad("businessId")}>
            <option value="">{requiresBusiness ? t("chooseBusiness") : t("noBusiness")}</option>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("city")}
          <select name="cityId" defaultValue={initial.cityId ?? ""} className={input}>
            <option value="">{t("noCity")}</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("category")}
          <select name="categoryId" defaultValue={initial.categoryId ?? ""} className={input}>
            <option value="">{t("noCategory")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </fieldset>

      {section === "jobs" && (
        <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
          <legend className="sr-only">{t(kind)}</legend>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("employmentType")}
            <select name="employmentType" defaultValue={initial.employmentType ?? "full_time"} className={input}>
              {EMPLOYMENT_TYPES.map((k) => <option key={k} value={k}>{t(`type_${k}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("expiresAt")}
            <input name="expiresAt" type="date" defaultValue={initial.expiresAt} className={input} aria-invalid={bad("expiresAt")} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("applyUrl")}
            <input name="applyUrl" type="url" dir="ltr" maxLength={500} placeholder="https://" defaultValue={initial.applyUrl} className={input} aria-invalid={bad("applyUrl")} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("applyEmail")}
            <input name="applyEmail" type="email" dir="ltr" maxLength={200} defaultValue={initial.applyEmail} className={input} aria-invalid={bad("applyEmail")} aria-describedby="apply-hint" />
          </label>
          <p id="apply-hint" className="text-xs text-muted sm:col-span-2">{t("applyHint")}</p>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold">{t("languagesRequired")}</legend>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((l) => (
                <label key={l} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                  <input type="checkbox" name="languages" value={l} defaultChecked={initial.languages?.includes(l)} className="size-4 accent-[var(--brand)]" />
                  <span lang={LOCALE_META[l].htmlLang}>{LOCALE_META[l].nativeName}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
      )}

      {section === "events" && (
        <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
          <legend className="sr-only">{t(kind)}</legend>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("startsAt")}
            <input name="startsAt" type="datetime-local" required defaultValue={initial.startsAt} className={input} aria-invalid={bad("startsAt")} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("endsAt")}
            <input name="endsAt" type="datetime-local" defaultValue={initial.endsAt} className={input} aria-invalid={bad("endsAt")} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("venue")}
            <input name="venue" maxLength={200} defaultValue={initial.venue} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("infoUrl")}
            <input name="infoUrl" type="url" dir="ltr" maxLength={500} placeholder="https://" defaultValue={initial.infoUrl} className={input} aria-invalid={bad("infoUrl")} />
          </label>
        </fieldset>
      )}

      {section === "guides" && (
        <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
          <legend className="sr-only">{t(kind)}</legend>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("readMinutes")}
            <input name="readMinutes" type="number" min={1} max={240} inputMode="numeric" defaultValue={initial.readMinutes} className={input} aria-invalid={bad("readMinutes")} />
          </label>
        </fieldset>
      )}

      <fieldset className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <legend className="px-1 text-base font-bold">{t("textsTitle")}</legend>
        <p className="text-sm text-muted">{t("textsHint")}</p>
        {LOCALES.map((l, i) => {
          const s = localeSuffix(l);
          const meta = LOCALE_META[l];
          const tx = initial.texts?.[l];
          return (
            <details key={l} className="rounded-xl border border-line px-4 py-3" open={i === 0 || Boolean(tx?.title)} lang={meta.htmlLang}>
              <summary className="cursor-pointer text-sm font-semibold">{meta.nativeName}</summary>
              <div className="mt-3 grid gap-3">
                <label className="flex flex-col gap-1 text-sm font-semibold">{t("titleIn", { language: meta.nativeName })}
                  <input name={`title${s}`} maxLength={200} dir={meta.dir} defaultValue={tx?.title ?? ""} className={input} aria-invalid={bad("title")} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">{t("summaryIn", { language: meta.nativeName })}
                  <textarea name={`summary${s}`} rows={2} maxLength={400} dir={meta.dir} defaultValue={tx?.summary ?? ""} className={`${input} py-2`} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">{t("bodyIn", { language: meta.nativeName })}
                  <textarea name={`body${s}`} rows={section === "guides" ? 12 : 6} maxLength={20000} dir={meta.dir} defaultValue={tx?.body ?? ""} className={`${input} py-2`} />
                </label>
              </div>
            </details>
          );
        })}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="save" disabled={saving} className="min-h-11 rounded-xl border border-line bg-surface px-6 text-sm font-bold hover:border-brand hover:text-brand disabled:opacity-60">{t("save")}</button>
        {canPublish ? (
          <button type="submit" name="intent" value="publish" disabled={saving} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("publish")}</button>
        ) : (
          <button type="submit" name="intent" value="submit" disabled={saving || locked || initial.status === "published"} data-testid="submit-review" className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("submit")}</button>
        )}
      </div>
    </form>
  );
}
