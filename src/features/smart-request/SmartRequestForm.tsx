"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Honeypot } from "@/features/forms/Honeypot";
import { createRequestAction, type SmartFormState } from "./actions";
import { REQUEST_RADII_KM } from "./rules";

const field = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 sm:text-sm";
const label = "flex flex-col gap-1.5 text-sm font-semibold";
const IDLE: SmartFormState = { status: "idle" };
const ERROR_KEY = { invalid: "errInvalid", rate: "errRate", failed: "errFailed", signin: "errSignin", unverified: "errUnverified", limit: "errLimit", forbidden: "errForbidden", closed: "errClosed", locked: "errLocked" } as const;

type Option = { id: string; label: string };

/** Public Radar request form: works for guests and signed-in users alike (no sign-in step). */
export function SmartRequestForm({ categories, cities }: { categories: Option[]; cities: Option[] }) {
  const t = useTranslations("smartRequest");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createRequestAction, IDLE);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<"idle" | "busy" | "ok" | "failed">("idle");
  const bad = (name: string) => state.fields?.includes(name) || undefined;

  function locate() {
    if (!("geolocation" in navigator)) return setGeo("failed");
    setGeo("busy");
    navigator.geolocation.getCurrentPosition(
      // Rounded to ~1 km in the browser already: the exact position never leaves the device.
      (p) => { setCoords({ lat: Math.round(p.coords.latitude * 100) / 100, lng: Math.round(p.coords.longitude * 100) / 100 }); setGeo("ok"); },
      () => { setCoords(null); setGeo("failed"); },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  return (
    <form action={action} data-testid="smart-request-form" className="relative grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <Honeypot label={tf("leaveEmpty")} />
      {coords && <><input type="hidden" name="lat" value={coords.lat} /><input type="hidden" name="lng" value={coords.lng} /></>}
      {state.status === "error" && state.error && (
        <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t(ERROR_KEY[state.error])}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <label className={label}>
          <span>{t("category")} <span aria-hidden="true" className="text-brand-text">*</span></span>
          <select name="categoryId" required defaultValue="" aria-invalid={bad("categoryId")} className={field}>
            <option value="" disabled>{t("categoryPlaceholder")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className={label}>
          <span>{t("titleLabel")} <span aria-hidden="true" className="text-brand-text">*</span></span>
          <input name="title" required minLength={3} maxLength={120} autoComplete="off" placeholder={t("titleHint")} aria-invalid={bad("title")} className={field} />
        </label>
      </div>

      <details className="group rounded-xl border border-line px-3 open:pb-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          {t("moreDetails")}
          <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-45">+</span>
        </summary>
        <label className="sr-only" htmlFor="sr-description">{t("description")}</label>
        <textarea id="sr-description" name="description" rows={3} maxLength={1000} aria-invalid={bad("description")} className={`${field} py-2`} />
      </details>

      <fieldset className="grid gap-3">
        <legend className="mb-1.5 text-sm font-semibold">{t("location")} <span aria-hidden="true" className="text-brand-text">*</span></legend>
        {coords ? (
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-brand bg-brand-soft px-3">
            <span role="status" className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden="true">◎</span>{t("locationSet")}</span>
            <button type="button" onClick={() => { setCoords(null); setGeo("idle"); }} className="min-h-11 px-2 text-sm font-semibold text-brand-text underline">{t("clearLocation")}</button>
          </div>
        ) : (
          <div className="grid items-center gap-2 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
            <button type="button" onClick={locate} disabled={geo === "busy"} aria-busy={geo === "busy"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand bg-surface px-4 text-sm font-bold text-brand-text hover:bg-brand-soft disabled:opacity-60">
              <span aria-hidden="true">◎</span>{t("useMyLocation")}
            </button>
            <span aria-hidden="true" className="text-center text-xs text-muted">{t("or")}</span>
            <label className="sr-only" htmlFor="sr-city">{t("city")}</label>
            <select id="sr-city" name="cityId" defaultValue="" aria-invalid={bad("cityId")} className={field}>
              <option value="">{t("cityPlaceholder")}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}
        {geo === "failed" && <p role="status" className="text-xs text-muted">{t("locationFailed")}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("radius")}</legend>
        <div className="flex flex-wrap gap-2">
          {REQUEST_RADII_KM.map((r) => (
            <label key={r} className="cursor-pointer">
              <input type="radio" name="radiusKm" value={r} defaultChecked={r === 10} className="peer sr-only" />
              <span dir="ltr" className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-full border border-line bg-surface px-3 text-sm font-semibold peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-text peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40">{r} km</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input name="consent" type="checkbox" required aria-invalid={bad("consent")} className="mt-0.5 size-5 shrink-0 accent-brand-control" />
        <span>{t("consent")}</span>
      </label>

      <button type="submit" disabled={pending} aria-busy={pending} className="min-h-12 w-full rounded-xl bg-brand px-6 text-base font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("submit")}</button>
    </form>
  );
}
