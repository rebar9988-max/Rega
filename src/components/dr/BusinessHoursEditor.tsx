"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { WEEK, applyMasterHours, hoursMode, normalizeDay, type HoursEditorSettings, type HoursMode, type WeekDay } from "@/lib/opening-hours";

/** Uses the existing weekday fields; appointment mode retains the complete weekly schedule. */
export function BusinessHoursEditor({ initial = {}, editor, mode, invalid }: {
  initial?: Partial<Record<WeekDay, string>>; editor?: HoursEditorSettings; mode?: HoursMode; invalid: (field: string) => boolean | undefined;
}) {
  const t = useTranslations("bizForm");
  const td = useTranslations("days");
  const [selected, setSelected] = useState<HoursMode>(mode ?? hoursMode(initial));
  const [days, setDays] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [settings, setSettings] = useState<HoursEditorSettings>(() => editor ?? {
    start: "09:00", end: "17:00", chosen: WEEK.slice(0, 5),
    customized: WEEK.filter(d => Boolean(initial[d]?.trim())),
  });
  const { start, end, chosen } = settings;
  function updateMaster(patch: Partial<HoursEditorSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setDays(current => applyMasterHours(current, next));
    setError(false);
  }
  const [error, setError] = useState(false);
  const control = "min-h-11 min-w-0 rounded-xl border border-line bg-surface px-3 focus-visible:outline-2 focus-visible:outline-brand";
  function select(next: HoursMode) {
    if (next === selected) return;
    const weekly = selected === "always" ? saved : days;
    if (next === "always") {
      setSaved(days);
      setDays(Object.fromEntries(WEEK.map(d => [d, "00:00–24:00"])));
    } else if (next === "five") {
      // A preset fills only untouched days; existing/manual schedules and closures stay intact.
      const nextSettings = { ...settings, chosen: WEEK.slice(0, 5) };
      setSettings(nextSettings);
      setDays(applyMasterHours({ ...weekly, ...Object.fromEntries(WEEK.slice(5).filter(d => !weekly[d]).map(d => [d, "closed"])) }, nextSettings));
    } else if (selected === "always") setDays(saved);
    setSelected(next);
  }
  return <div className="space-y-3">
    <input type="hidden" name="hoursEditor" value={JSON.stringify(settings)} />
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("sectionHours")}>
      {([['always', 'modeAlways'], ['five', 'modeFive'], ['custom', 'modeCustom'], ['appointment', 'modeAppointment']] as const).map(([value, label]) =>
        <label key={value} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${selected === value ? 'border-brand bg-brand-soft font-semibold' : 'border-line bg-surface'}`}>
          <input type="radio" name="hoursMode" value={value} checked={selected === value} onChange={() => select(value)} className="size-4 accent-brand" />
          <span>{t(label)}{value === "always" && <span className="mt-0.5 block text-xs text-muted">{t("modeAlwaysHint")}</span>}</span>
        </label>)}
    </div>
    {(selected === "always" || selected === "appointment") && <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm">{t(selected === "always" ? "modeAlwaysHint" : "modeAppointmentHint")}</p>}
    {(selected === "custom" || selected === "five") && <>
      <p id="hours-hint" className="text-sm text-muted">{t("hoursHint")} {t("hoursAutoHint")}</p>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">{t("hoursApply")}</legend>
        <div className="flex flex-wrap gap-2">{WEEK.map(d => <label key={d} className="flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 text-sm"><input type="checkbox" checked={chosen.includes(d)} onChange={e => updateMaster({ chosen: e.target.checked ? [...chosen, d] : chosen.filter(x => x !== d) })} />{td(d)}</label>)}</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">{t("hoursStart")}<input type="time" dir="ltr" className={control} value={start} data-testid="hours-master-start" onChange={e => updateMaster({ start: e.target.value })} /></label>
          <label className="grid gap-1 text-sm">{t("hoursEnd")}<input type="time" dir="ltr" className={control} value={end} data-testid="hours-master-end" onChange={e => updateMaster({ end: e.target.value })} /></label>
          <button type="button" className={`${control} text-sm font-semibold`} onClick={() => {
            const value = normalizeDay(`${start}–${end}`);
            setError(!value || !chosen.length);
            if (value && chosen.length) {
              setDays(current => applyMasterHours(current, settings, true));
              setSettings({ ...settings, customized: settings.customized.filter(d => !chosen.includes(d)) });
            }
          }}>{t("hoursApply")}</button>
        </div>
        {error && <p role="alert" className="text-sm text-brand">{t("hoursInvalid")}</p>}
      </fieldset>
    </>}
    <div hidden={selected === "always" || selected === "appointment"} className="grid gap-2 sm:grid-cols-2">
      {WEEK.map(d => <label key={d} className="grid min-w-0 grid-cols-[5rem_1fr] items-center gap-2 text-sm"><span>{td(d)}</span>
        <input name={`hours_${d}`} value={days[d] ?? ""} onChange={e => {
          setDays({ ...days, [d]: e.target.value });
          setSettings({ ...settings, customized: [...new Set([...settings.customized, d])] });
        }} dir="ltr" maxLength={120} placeholder="09:00–17:00" className={control} aria-invalid={invalid(`hours_${d}`)} aria-describedby="hours-hint" data-testid={`hours-${d}`} />
      </label>)}
    </div>
  </div>;
}
