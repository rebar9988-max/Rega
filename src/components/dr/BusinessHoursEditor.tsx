"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { WEEK, hoursMode, normalizeDay, type HoursMode, type WeekDay } from "@/lib/opening-hours";

/** Uses the existing weekday fields; appointment mode retains the complete weekly schedule. */
export function BusinessHoursEditor({ initial = {}, mode, invalid }: {
  initial?: Partial<Record<WeekDay, string>>; mode?: HoursMode; invalid: (field: string) => boolean | undefined;
}) {
  const t = useTranslations("bizForm");
  const td = useTranslations("days");
  const [selected, setSelected] = useState<HoursMode>(mode ?? hoursMode(initial));
  const [days, setDays] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [chosen, setChosen] = useState<WeekDay[]>(WEEK.slice(0, 5));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [error, setError] = useState(false);
  const control = "min-h-11 min-w-0 rounded-xl border border-line bg-surface px-3 focus-visible:outline-2 focus-visible:outline-brand";
  function select(next: HoursMode) {
    if (next === selected) return;
    if (next === "always" || next === "five") {
      setSaved(days);
      setDays(Object.fromEntries(WEEK.map((d, i) => [d, next === "always" ? "00:00–24:00" : i < 5 ? `${start}–${end}` : "closed"])));
      setChosen(WEEK.slice(0, 5));
    } else if (selected === "always" && next === "custom") setDays(saved);
    setSelected(next);
  }
  return <div className="space-y-3">
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("sectionHours")}>
      {([['always', 'modeAlways'], ['five', 'modeFive'], ['custom', 'modeCustom'], ['appointment', 'modeAppointment']] as const).map(([value, label]) =>
        <label key={value} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${selected === value ? 'border-brand bg-brand-soft font-semibold' : 'border-line bg-surface'}`}>
          <input type="radio" name="hoursMode" value={value} checked={selected === value} onChange={() => select(value)} className="size-4 accent-brand" />
          <span>{t(label)}{value === "always" && <span className="mt-0.5 block text-xs text-muted">{t("modeAlwaysHint")}</span>}</span>
        </label>)}
    </div>
    {(selected === "always" || selected === "appointment") && <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm">{t(selected === "always" ? "modeAlwaysHint" : "modeAppointmentHint")}</p>}
    {(selected === "custom" || selected === "five") && <>
      <p id="hours-hint" className="text-sm text-muted">{t("hoursHint")}</p>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">{t("hoursApply")}</legend>
        <div className="flex flex-wrap gap-2">{WEEK.map(d => <label key={d} className="flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 text-sm"><input type="checkbox" checked={chosen.includes(d)} onChange={e => setChosen(e.target.checked ? [...chosen, d] : chosen.filter(x => x !== d))} />{td(d)}</label>)}</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">{t("hoursStart")}<input type="time" dir="ltr" className={control} value={start} onChange={e => setStart(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">{t("hoursEnd")}<input type="time" dir="ltr" className={control} value={end} onChange={e => setEnd(e.target.value)} /></label>
          <button type="button" className={`${control} text-sm font-semibold`} onClick={() => {
            const value = normalizeDay(`${start}–${end}`);
            setError(!value || !chosen.length);
            if (value && chosen.length) setDays(Object.fromEntries(WEEK.map(d => [d, chosen.includes(d) ? value : selected === "five" ? "closed" : days[d] ?? ""])));
          }}>{t("hoursApply")}</button>
        </div>
        {error && <p role="alert" className="text-sm text-brand">{t("hoursInvalid")}</p>}
      </fieldset>
    </>}
    <div hidden={selected === "always" || selected === "appointment"} className="grid gap-2 sm:grid-cols-2">
      {WEEK.map(d => <label key={d} className="grid min-w-0 grid-cols-[5rem_1fr] items-center gap-2 text-sm"><span>{td(d)}</span>
        <input name={`hours_${d}`} value={days[d] ?? ""} onChange={e => setDays({ ...days, [d]: e.target.value })} dir="ltr" maxLength={120} placeholder="09:00–17:00" className={control} aria-invalid={invalid(`hours_${d}`)} aria-describedby="hours-hint" data-testid={`hours-${d}`} />
      </label>)}
    </div>
  </div>;
}
