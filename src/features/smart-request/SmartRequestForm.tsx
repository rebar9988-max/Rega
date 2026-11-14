"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Honeypot } from "@/features/forms/Honeypot";
import { createRequestAction, type SmartFormState } from "./actions";
import { REQUEST_RADII_KM } from "./rules";

const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";
const IDLE: SmartFormState = { status: "idle" };
const ERROR_KEY = { invalid: "errInvalid", rate: "errRate", failed: "errFailed", signin: "errSignin", unverified: "errUnverified", limit: "errLimit", forbidden: "errForbidden", closed: "errClosed", locked: "errLocked" } as const;

type Option = { id: string; label: string };

export function SmartRequestForm({ categories, cities }: { categories: Option[]; cities: Option[] }) {
  const t = useTranslations("smartRequest");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createRequestAction, IDLE);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<"idle" | "ok" | "failed">("idle");
  const bad = (name: string) => state.fields?.includes(name) || undefined;

  function locate() {
    if (!("geolocation" in navigator)) return setGeo("failed");
    navigator.geolocation.getCurrentPosition(
      // Rounded to ~1 km in the browser already: the exact position never leaves the device.
      (p) => { setCoords({ lat: Math.round(p.coords.latitude * 100) / 100, lng: Math.round(p.coords.longitude * 100) / 100 }); setGeo("ok"); },
      () => { setCoords(null); setGeo("failed"); },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  return (
    <form action={action} data-testid="smart-request-form" className="relative grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <Honeypot label={tf("leaveEmpty")} />
      {coords && <><input type="hidden" name="lat" value={coords.lat} /><input type="hidden" name="lng" value={coords.lng} /></>}
      {state.status === "error" && state.error && (
        <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t(ERROR_KEY[state.error])}</p>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("category")} <span aria-hidden="true" className="text-brand-text">*</span>
        <select name="categoryId" required defaultValue="" aria-invalid={bad("categoryId")} className={field}>
          <option value="" disabled>{t("categoryPlaceholder")}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("titleLabel")} <span aria-hidden="true" className="text-brand-text">*</span>
        <input name="title" required minLength={3} maxLength={120} aria-invalid={bad("title")} className={field} />
        <span className="text-xs font-normal text-muted">{t("titleHint")}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("description")}
        <textarea name="description" rows={4} maxLength={1000} aria-invalid={bad("description")} className={`${field} py-2`} />
      </label>
      <fieldset className="grid gap-3 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">{t("location")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("city")}
          <select name="cityId" defaultValue="" aria-invalid={bad("cityId")} className={field} disabled={coords !== null}>
            <option value="">{t("cityPlaceholder")}</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={locate} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:border-brand">{t("useMyLocation")}</button>
          <span role="status" className="text-xs text-muted">{geo === "ok" ? t("locationSet") : geo === "failed" ? t("locationFailed") : ""}</span>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("radius")}
          <select name="radiusKm" defaultValue="10" className={field}>
            {REQUEST_RADII_KM.map((r) => <option key={r} value={r}>{r} km</option>)}
          </select>
        </label>
      </fieldset>
      <label className="flex items-start gap-3 text-sm">
        <input name="consent" type="checkbox" required aria-invalid={bad("consent")} className="mt-1 size-5 shrink-0 accent-brand-control" />
        <span>{t("consent")}</span>
      </label>
      <p className="text-xs text-muted">{t("privacyNote")}</p>
      <div>
        <button type="submit" disabled={pending} className="min-h-12 w-full rounded-xl bg-brand px-6 text-base font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60 sm:w-auto">{t("submit")}</button>
      </div>
    </form>
  );
}
