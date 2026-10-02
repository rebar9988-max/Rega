"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { importAction, type ImportState } from "./actions";

export function ImportForm() {
  const t = useTranslations("importer");
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, undefined);
  return (
    <>
      <form action={action} className="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5" data-testid="import-form">
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("file")}
          <input type="file" name="file" accept=".csv,text/csv" required className="min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="dryRun" value="1" defaultChecked className="size-5 accent-[var(--brand)]" />{t("dryRun")}</label>
        <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("run")}</button>
      </form>
      {state && !state.ok && <p role="alert" data-testid="import-error" className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t(`error_${state.error}`, { detail: state.detail ?? "" })}</p>}
      {state?.ok && (
        <section aria-live="polite" className="mt-6 space-y-3" data-testid="import-result">
          <p className="text-sm font-semibold">{t(state.dryRun ? "resultDry" : "resultDone", { created: state.created, skipped: state.skipped, errors: state.errors })}</p>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="bg-surface-2 text-muted"><tr><th className="px-3 py-2 text-start">#</th><th className="px-3 py-2 text-start">{t("name")}</th><th className="px-3 py-2 text-start">{t("outcome")}</th></tr></thead>
              <tbody className="divide-y divide-line">
                {state.rows.map((r) => (
                  <tr key={r.line}><td className="px-3 py-2">{r.line}</td><td className="px-3 py-2"><bdi>{r.name}</bdi></td><td className="px-3 py-2">{t(`row_${r.status}`)}{r.message ? ` — ${r.message}` : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
