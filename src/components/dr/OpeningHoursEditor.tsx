"use client";

/**
 * Weekly opening hours as structured controls: per day open/closed, time ranges (split shifts, overnight such as
 * 20:00–02:00) or open 24 hours, plus copying Monday to other days. It writes the long-standing stored format into
 * hidden `hours_<day>` fields ("09:00–17:00, 18:00–22:00" | "00:00–24:00" | "closed"), so the server validation
 * (src/lib/opening-hours.ts) and every reader stay unchanged. No hours at all = unknown, never shown as open.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { WEEK, type WeekDay } from "@/lib/opening-hours";
import { DEFAULT_RANGE, WEEKDAYS, dayFromStored, dayToStored, type Day, type Range } from "@/lib/hours-form";

type Week = Record<WeekDay, Day>;

const inputClass = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-2 text-base tabular-nums outline-none focus:border-brand aria-[invalid=true]:border-brand";

export function OpeningHoursEditor({ initial, invalidDays = [], onChange }: {
  initial: Partial<Record<WeekDay, string>>; invalidDays?: string[]; onChange?: () => void;
}) {
  const t = useTranslations("bizForm.hoursEditor");
  const td = useTranslations("days");
  const hasInitial = WEEK.some((d) => (initial[d] ?? "").trim());
  const [enabled, setEnabled] = useState(hasInitial);
  const [week, setWeek] = useState<Week>(() => Object.fromEntries(WEEK.map((d) => [d, dayFromStored(initial[d])])) as Week);

  function update(next: Week) { setWeek(next); onChange?.(); }
  function setDay(d: WeekDay, patch: Partial<Day>) { update({ ...week, [d]: { ...week[d], ...patch } }); }
  function setRange(d: WeekDay, i: number, patch: Partial<Range>) { setDay(d, { ranges: week[d].ranges.map((r, j) => (j === i ? { ...r, ...patch } : r)) }); }
  function copyMonday(days: WeekDay[]) {
    const source = week.mon;
    update({ ...week, ...Object.fromEntries(days.map((d) => [d, { ...source, ranges: source.ranges.map((r) => ({ ...r })) }])) });
  }
  function start() {
    // A visible starting point the owner edits: Monday–Friday 09:00–17:00, the weekend closed. Nothing is saved until they save.
    setWeek(Object.fromEntries(WEEK.map((d) => [d, { open: WEEKDAYS.includes(d), allDay: false, ranges: [{ ...DEFAULT_RANGE }] }])) as Week);
    setEnabled(true); onChange?.();
  }

  if (!enabled) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-line p-4" data-testid="hours-editor">
        {WEEK.map((d) => <input key={d} type="hidden" name={`hours_${d}`} value="" data-testid={`hours-${d}`} />)}
        <p className="text-sm text-muted">{t("notSet")}</p>
        <button type="button" onClick={start} data-testid="hours-start"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand hover:bg-brand hover:text-brand-ink">
          <span aria-hidden="true" className="text-lg leading-none">+</span>{t("add")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="hours-editor">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copyMonday(WEEK.filter((d) => d !== "mon"))} data-testid="hours-copy-all"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-soft px-3 text-sm font-semibold text-brand hover:bg-brand hover:text-brand-ink">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
          {t("copyAll")}
        </button>
        <button type="button" onClick={() => copyMonday(WEEKDAYS.filter((d) => d !== "mon"))} data-testid="hours-copy-weekdays"
          className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold hover:border-brand hover:text-brand">
          {t("copyWeekdays")}
        </button>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {WEEK.map((d) => {
          const day = week[d];
          const stored = dayToStored(day);
          const invalid = stored === null || invalidDays.includes(`hours_${d}`);
          const label = td(d);
          return (
            <li key={d} className="grid gap-2 p-3 sm:grid-cols-[8rem_auto_1fr] sm:items-start" data-testid={`hours-row-${d}`}>
              <input type="hidden" name={`hours_${d}`} value={stored ?? day.ranges.map((r) => `${r.from}–${r.to}`).join(", ")} data-testid={`hours-${d}`} />
              <div className="flex min-h-11 items-center justify-between gap-3 sm:contents">
                <span className="font-semibold sm:flex sm:min-h-11 sm:items-center" id={`hours-label-${d}`}>{label}</span>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
                  <span className="relative inline-flex shrink-0">
                    <input type="checkbox" role="switch" checked={day.open} onChange={(e) => setDay(d, { open: e.target.checked })}
                      aria-labelledby={`hours-label-${d}`} aria-describedby={`hours-state-${d}`} data-testid={`hours-open-${d}`}
                      className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0" />
                    <span aria-hidden="true" className="relative h-7 w-12 rounded-full bg-surface-2 ring-1 ring-line transition peer-checked:bg-brand peer-checked:ring-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand after:absolute after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all after:start-1 peer-checked:after:start-6" />
                  </span>
                  <span id={`hours-state-${d}`} className="min-w-16 text-muted">{day.open ? t("open") : t("closed")}</span>
                </label>
              </div>
              {day.open ? (
                <div className="min-w-0 space-y-2">
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={day.allDay} onChange={(e) => setDay(d, { allDay: e.target.checked })} className="size-4 accent-[var(--brand)]" data-testid={`hours-allday-${d}`} />
                    {t("allDay")}
                  </label>
                  {!day.allDay && day.ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2" role="group" aria-label={`${label} ${i + 1}`}>
                      <label className="min-w-0 flex-1"><span className="sr-only">{label} – {t("from")}</span>
                        <input type="time" value={r.from} onChange={(e) => setRange(d, i, { from: e.target.value })} className={inputClass} dir="ltr" aria-invalid={invalid && (!r.from || r.from === r.to) ? true : undefined} data-testid={`hours-from-${d}-${i}`} />
                      </label>
                      <span aria-hidden="true" className="text-muted">—</span>
                      <label className="min-w-0 flex-1"><span className="sr-only">{label} – {t("to")}</span>
                        <input type="time" value={r.to} onChange={(e) => setRange(d, i, { to: e.target.value })} className={inputClass} dir="ltr" aria-invalid={invalid && (!r.to || r.from === r.to) ? true : undefined} data-testid={`hours-to-${d}-${i}`} />
                      </label>
                      {day.ranges.length > 1 && (
                        <button type="button" onClick={() => setDay(d, { ranges: day.ranges.filter((_, j) => j !== i) })} aria-label={`${t("removeRange")} – ${label} ${i + 1}`}
                          className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted hover:border-brand hover:text-brand" data-testid={`hours-remove-${d}-${i}`}>
                          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {!day.allDay && day.ranges.some((r) => r.from && r.to && r.to !== "00:00" && r.to < r.from) && <p className="text-xs text-muted">{t("overnight")}</p>}
                  {invalid && <p role="alert" className="text-xs font-semibold text-brand">{t("invalid")}</p>}
                  {!day.allDay && day.ranges.length < 3 && (
                    <button type="button" onClick={() => setDay(d, { ranges: [...day.ranges, { from: "", to: "" }] })} data-testid={`hours-add-${d}`}
                      className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand hover:underline">
                      <span aria-hidden="true">+</span>{t("addRange")}
                    </button>
                  )}
                </div>
              ) : <span aria-hidden="true" className="hidden sm:block" />}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => { setEnabled(false); onChange?.(); }} data-testid="hours-clear"
        className="inline-flex min-h-9 items-center text-sm font-semibold text-muted underline hover:text-ink">{t("clear")}</button>
    </div>
  );
}
