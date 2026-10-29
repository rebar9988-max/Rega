"use client";

/**
 * Holiday setting and date exceptions (temporary closures, special hours) inside the business form's hours section.
 * The rows travel to the server as one JSON field (`hoursExceptions`) and are validated there again
 * (parseHoursExceptions); this component only helps to fill them in. Existing entries are always sent back, so saving
 * the form never drops them.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { EXCEPTION_LIMITS, type HoursException } from "@/lib/opening-hours";

type Row = { key: number; from: string; to: string; closed: boolean; hours: string; reason: string };

const input = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand aria-[invalid=true]:border-brand";

export function HoursExceptionsEditor({ initial, holidaysClosed, invalid }: { initial: HoursException[]; holidaysClosed: boolean; invalid?: boolean }) {
  const t = useTranslations("bizForm");
  const [rows, setRows] = useState<Row[]>(() => initial.map((e, key) => ({
    key, from: e.from, to: e.to, closed: e.hours === "closed", hours: e.hours === "closed" ? "" : e.hours, reason: e.reason ?? "",
  })));
  const [nextKey, setNextKey] = useState(initial.length);
  const update = (key: number, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // A row added but left completely empty is not sent; a partly filled one is, so the server can point at it.
  const payload = rows.filter((r) => r.from || r.hours.trim() || r.reason.trim()).map((r) => ({ from: r.from, to: r.to || r.from, hours: r.closed ? "closed" : r.hours, ...(r.reason.trim() ? { reason: r.reason } : {}) }));

  return (
    <div className="space-y-4" data-testid="hours-exceptions">
      <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
        <input type="checkbox" name="holidaysClosed" value="1" defaultChecked={holidaysClosed} className="mt-0.5 size-5 accent-brand-control" data-testid="holidays-closed" />
        <span><span className="font-semibold">{t("holidaysClosed")}</span><br /><span className="text-muted">{t("holidaysClosedHint")}</span></span>
      </label>

      <div className="space-y-3">
        <p className="text-sm font-semibold">{t("exceptionsTitle")}</p>
        <p className="text-sm text-muted" id="exceptions-hint">{t("exceptionsHint")}</p>
        {invalid && <p className="text-sm font-semibold text-brand-text" role="alert" data-testid="exceptions-invalid">{t("exceptionsInvalid")}</p>}
        <input type="hidden" name="hoursExceptions" value={JSON.stringify(payload)} />
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.key} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2" data-testid={`exception-${i}`}>
              <label className="flex flex-col gap-1 text-sm font-semibold">{t("exceptionFrom")}
                <input type="date" value={r.from} required onChange={(e) => update(r.key, { from: e.target.value, to: r.to && r.to >= e.target.value ? r.to : e.target.value })}
                  className={input} aria-invalid={invalid || undefined} aria-describedby="exceptions-hint" data-testid={`exception-from-${i}`} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">{t("exceptionTo")}
                <input type="date" value={r.to} min={r.from || undefined} onChange={(e) => update(r.key, { to: e.target.value })}
                  className={input} aria-invalid={invalid || undefined} data-testid={`exception-to-${i}`} />
              </label>
              <fieldset className="flex flex-wrap gap-4 text-sm sm:col-span-2">
                <legend className="sr-only">{t("exceptionsTitle")}</legend>
                <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`exception-kind-${r.key}`} checked={r.closed} onChange={() => update(r.key, { closed: true })} className="size-5 accent-brand-control" data-testid={`exception-closed-${i}`} />{t("exceptionClosed")}</label>
                <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`exception-kind-${r.key}`} checked={!r.closed} onChange={() => update(r.key, { closed: false })} className="size-5 accent-brand-control" data-testid={`exception-special-${i}`} />{t("exceptionSpecial")}</label>
              </fieldset>
              {!r.closed && (
                <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("exceptionHours")}
                  <input value={r.hours} onChange={(e) => update(r.key, { hours: e.target.value })} dir="ltr" maxLength={120} placeholder="10:00–14:00" autoComplete="off"
                    className={input} aria-invalid={invalid || undefined} data-testid={`exception-hours-${i}`} />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("exceptionReason")}
                <input value={r.reason} onChange={(e) => update(r.key, { reason: e.target.value })} maxLength={EXCEPTION_LIMITS.reason} autoComplete="off" className={input} data-testid={`exception-reason-${i}`} />
              </label>
              <div className="sm:col-span-2">
                <button type="button" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
                  className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold hover:border-brand hover:text-brand-text" data-testid={`exception-remove-${i}`}>{t("exceptionRemove")}</button>
              </div>
            </li>
          ))}
        </ul>
        {rows.length < EXCEPTION_LIMITS.max && (
          <button type="button" onClick={() => { setRows((all) => [...all, { key: nextKey, from: "", to: "", closed: true, hours: "", reason: "" }]); setNextKey((k) => k + 1); }}
            className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:border-brand hover:text-brand-text" data-testid="exception-add">{t("exceptionAdd")}</button>
        )}
      </div>
    </div>
  );
}
