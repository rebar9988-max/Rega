"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveCategoryAction, type CategoryFormState } from "@/app/dr/categories/actions";

export type CategoryInitial = {
  id?: string; nameCkb?: string; nameKmr?: string | null; nameDe?: string; nameEn?: string | null; nameAr?: string | null; nameFa?: string | null; nameTr?: string | null;
  parentId?: string | null; sortOrder?: number;
};

const input = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand aria-[invalid=true]:border-brand";
/** One name per interface language; Sorani and German are required (Sorani is the default locale, German the canonical text). */
const NAMES = [
  { key: "nameCkb", dir: "rtl", required: true }, { key: "nameKmr", dir: "ltr" }, { key: "nameDe", dir: "ltr", required: true },
  { key: "nameEn", dir: "ltr" }, { key: "nameAr", dir: "rtl" }, { key: "nameFa", dir: "rtl" }, { key: "nameTr", dir: "ltr" },
] as const;

export function CategoryForm({ initial, parents }: { initial: CategoryInitial; parents: { id: string; name: string }[] }) {
  const t = useTranslations("catForm");
  const tb = useTranslations("bizForm");
  const [state, formAction, saving] = useActionState<CategoryFormState, FormData>(saveCategoryAction, undefined);
  const [, startSubmit] = useTransition();
  const bad = (f: string) => state?.fields?.includes(f) || undefined;

  return (
    <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startSubmit(() => formAction(data)); }}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state?.error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink" data-testid="form-error">{t(`error_${state.error}`)}</p>}
      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionNames")}</legend>
        {NAMES.map((n) => (
          <label key={n.key} className="flex flex-col gap-1 text-sm font-semibold">{t(n.key)}
            <input name={n.key} dir={n.dir} maxLength={200} required={"required" in n} defaultValue={initial[n.key] ?? ""} className={input} aria-invalid={bad(n.key)} />
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionPlacement")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("parent")}
          <select name="parentId" defaultValue={initial.parentId ?? ""} className={input} aria-invalid={bad("parentId")}>
            <option value="">{t("noParent")}</option>
            {parents.filter((p) => p.id !== initial.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("sortOrder")}
          <input name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={initial.sortOrder ?? 0} className={input} aria-invalid={bad("sortOrder")} />
        </label>
      </fieldset>
      <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{tb("save")}</button>
    </form>
  );
}
