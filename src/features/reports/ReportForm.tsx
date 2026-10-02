"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Honeypot } from "@/features/forms/Honeypot";
import { IDLE, type FormState } from "@/features/forms/state";
import { submitReport } from "./actions";
import { REPORT_REASONS } from "./reasons";

const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";
const REASON_KEY = { illegal: "reasonIllegal", misleading: "reasonMisleading", spam: "reasonSpam", copyright: "reasonCopyright", privacy: "reasonPrivacy", other: "reasonOther" } as const;

export function ReportForm({ defaultUrl }: { defaultUrl?: string }) {
  const t = useTranslations("report");
  const tf = useTranslations("forms");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const [state, action, pending] = useActionState<FormState, FormData>(submitReport, IDLE);

  if (state.status === "ok") {
    return (
      <div role="status" data-testid="report-sent" className="rounded-xl bg-brand-soft px-4 py-5">
        <p className="font-bold">{t("sentTitle")}</p>
        <p className="mt-1 text-sm">{t("sentBody")}</p>
      </div>
    );
  }
  const bad = (name: string) => state.fields?.includes(name) || undefined;
  return (
    <form action={action} data-testid="report-form" className="relative grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      <Honeypot label={tf("leaveEmpty")} />
      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold sm:col-span-2">
          {state.error === "rate" ? tf("rateLimited") : state.error === "invalid" ? tf("invalid") : tf("failed")}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("url")}
        <input name="url" type="url" required maxLength={500} dir="ltr" defaultValue={defaultUrl} aria-invalid={bad("url")} className={`${field} text-start`} />
        <span className="text-xs font-normal text-muted">{t("urlHint")}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("reason")}
        <select name="reason" required defaultValue="illegal" className={field}>
          {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(REASON_KEY[r])}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("details")}
        <textarea name="details" required minLength={10} rows={5} maxLength={4000} aria-invalid={bad("details")} className={`${field} py-2`} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("name")}
        <input name="name" required minLength={2} maxLength={120} autoComplete="name" aria-invalid={bad("name")} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("email")}
        <input name="email" type="email" required maxLength={200} autoComplete="email" dir="ltr" aria-invalid={bad("email")} className={`${field} text-start`} />
      </label>
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input name="goodFaith" type="checkbox" required className="mt-1 size-5 shrink-0 accent-[var(--brand)]" />
        <span>{t("goodFaith")}</span>
      </label>
      <p className="text-xs text-muted sm:col-span-2">
        {tf("privacyNote")} <Link href="/privacy" className="font-semibold text-brand underline">{tn("privacy")}</Link>
      </p>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("submit")}</button>
      </div>
    </form>
  );
}
