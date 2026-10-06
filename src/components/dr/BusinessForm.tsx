"use client";

/**
 * Admin create/edit form: business details, address and a confirmed map location. Everything is validated again
 * on the server (saveBusinessAction); this component only helps the admin fill it in correctly.
 */
import dynamic from "next/dynamic";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_META, localeSuffix, type Locale } from "@/config/locales";
import { isValidCoordinate } from "@/lib/coordinates";
import type { GeocodeHit } from "@/lib/geocoder-parse";
import { geocodeAction, saveBusinessAction, type BusinessFormState } from "@/app/dr/businesses/actions";
import { WEEK, type WeekDay } from "@/lib/opening-hours";
import { MediaField } from "./MediaField";

const LocationPicker = dynamic(() => import("./LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-[var(--radius-card)] bg-surface-2" aria-hidden="true" />,
});

export type FormCity = { id: string; name: string; names: string[]; countryCode: string; lat: number | null; lng: number | null };
export type FormInitial = {
  id?: string; name?: string; nameCkb?: string; categoryId?: string; description?: string; descriptionCkb?: string;
  phone?: string; email?: string; website?: string; addressLine1?: string; postalCode?: string; city?: string; countryCode?: string;
  latitude?: number | null; longitude?: number | null; coordsSource?: string | null; coordsVerified?: boolean;
  status?: string;
  hours?: Partial<Record<WeekDay, string>>; logoUrl?: string | null; coverUrl?: string | null;
  /** Description per language (key = locale code; field name is description<Suffix>). */
  translations?: Partial<Record<Locale, string>>;
  languages?: string[];
};

const input = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand aria-[invalid=true]:border-brand";

export function BusinessForm({ initial, categories, countries, cities, canPublish, storageReady }: {
  initial: FormInitial; categories: { id: string; name: string }[]; countries: { code: string; name: string }[];
  cities: FormCity[]; canPublish: boolean; storageReady: boolean;
}) {
  const t = useTranslations("bizForm");
  const td = useTranslations("days");
  const tm = useTranslations("map");
  const locale = useLocale() as Locale;
  const dir = LOCALE_META[locale].dir;
  const [state, formAction, saving] = useActionState<BusinessFormState, FormData>(saveBusinessAction, undefined);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [country, setCountry] = useState(initial.countryCode ?? "DE");
  const [city, setCity] = useState(initial.city ?? "");
  const [address, setAddress] = useState(initial.addressLine1 ?? "");
  const [postal, setPostal] = useState(initial.postalCode ?? "");
  const [lat, setLat] = useState(initial.latitude != null ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial.longitude != null ? String(initial.longitude) : "");
  const [source, setSource] = useState(initial.coordsSource ?? "");
  const [confirmed, setConfirmed] = useState(Boolean(initial.coordsVerified));
  const [lookup, setLookup] = useState<{ status: "idle" | "hits" | "not_found" | "unavailable"; hits: GeocodeHit[] }>({ status: "idle", hits: [] });
  const [finding, startFinding] = useTransition();
  const [, startSubmit] = useTransition();
  const bad = (f: string) => state?.fields?.includes(f) || undefined;

  const latNum = lat.trim() === "" ? NaN : Number(lat);
  const lngNum = lng.trim() === "" ? NaN : Number(lng);
  const coordsGiven = lat.trim() !== "" || lng.trim() !== "";
  const coordsOk = isValidCoordinate(latNum, lngNum);
  const value = coordsOk ? { lat: latNum, lng: lngNum } : null;
  const countryCities = cities.filter((c) => c.countryCode === country);
  const cityMatch = useMemo(() => countryCities.find((c) => c.names.some((n) => n.toLocaleLowerCase() === city.trim().toLocaleLowerCase())), [countryCities, city]);
  const cityCentre = cityMatch?.lat != null && cityMatch.lng != null ? { lat: cityMatch.lat, lng: cityMatch.lng } : null;

  function place(v: { lat: number; lng: number }, how: "geocoded" | "manual") {
    setLat(String(v.lat));
    setLng(String(v.lng));
    setSource(how);
    setConfirmed(false); // a new position always needs a fresh confirmation
  }

  function find() {
    startFinding(async () => {
      const res = await geocodeAction({ addressLine1: address, postalCode: postal || undefined, city, countryCode: country });
      if (!res.ok) return setLookup({ status: res.reason === "not_found" ? "not_found" : "unavailable", hits: [] });
      setLookup({ status: "hits", hits: res.hits });
      const best = res.hits.find((h) => h.precision === "address") ?? res.hits[0];
      place(best, "geocoded");
    });
  }

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
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state?.error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink" data-testid="form-error">{t(state.error === "published_incomplete" ? "publishedIncomplete" : state.error === "unverified" ? "unverifiedEmail" : state.error === "city_unknown" ? "cityUnknown" : "invalid")}</p>}

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionBasics")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("name")}
          <input name="name" required minLength={2} maxLength={200} defaultValue={initial.name} className={input} aria-invalid={bad("name")} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("nameCkb")}
          <input name="nameCkb" maxLength={200} defaultValue={initial.nameCkb} dir="rtl" className={input} />
        </label>
        <div className="relative flex flex-col gap-1 text-sm font-semibold">
          <span>{t("category")}</span>
          <input type="hidden" name="categoryId" value={categoryId} />
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={categoryOpen}
            aria-invalid={bad("categoryId")}
            onClick={() => setCategoryOpen((v) => !v)}
            className={`${input} flex items-center justify-between text-start`}
          >
            <span className={categoryId ? "" : "text-muted"}>
              {categories.find((c) => c.id === categoryId)?.name ?? t("chooseCategory")}
            </span>
            <span aria-hidden="true" className="ms-2 shrink-0 text-muted">⌄</span>
          </button>
          {categoryOpen && (
            <div
              role="listbox"
              aria-label={t("category")}
              className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-1 shadow-xl"
            >
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={c.id === categoryId}
                  onClick={() => { setCategoryId(c.id); setCategoryOpen(false); }}
                  className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-start text-sm font-medium hover:bg-surface-2 focus:bg-surface-2 focus:outline-none aria-selected:bg-brand-soft aria-selected:text-brand"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("description")}
          <textarea name="description" rows={3} maxLength={8000} defaultValue={initial.description} className={`${input} py-2`} />
        </label>
        <details className="rounded-xl border border-line px-4 py-3 sm:col-span-2" open={LOCALES.some((l) => initial.translations?.[l])}>
          <summary className="cursor-pointer text-sm font-semibold">{t("translations")}</summary>
          <p className="mt-2 text-xs text-muted">{t("translationsHint")}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {LOCALES.map((l) => (
              <label key={l} className="flex flex-col gap-1 text-sm font-semibold" lang={LOCALE_META[l].htmlLang}>
                <span>{t("descriptionIn", { language: LOCALE_META[l].nativeName })}</span>
                <textarea name={`description${localeSuffix(l)}`} rows={3} maxLength={8000} dir={LOCALE_META[l].dir} defaultValue={initial.translations?.[l] ?? ""} className={`${input} py-2`} />
              </label>
            ))}
          </div>
        </details>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">{t("languagesSpoken")}</legend>
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

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-3">
        <legend className="px-1 text-base font-bold">{t("sectionContact")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("phone")}
          <input name="phone" type="tel" dir="ltr" maxLength={50} defaultValue={initial.phone} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("email")}
          <input name="email" type="email" dir="ltr" maxLength={200} defaultValue={initial.email} className={input} aria-invalid={bad("email")} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("website")}
          <input name="website" type="url" dir="ltr" maxLength={300} placeholder="https://" defaultValue={initial.website} className={input} aria-invalid={bad("website")} />
        </label>
      </fieldset>

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <legend className="px-1 text-base font-bold">{t("sectionLocation")}</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-semibold lg:col-span-2">{t("address")}
            <input name="addressLine1" required minLength={3} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} className={input} aria-invalid={bad("addressLine1")} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("postalCode")}
            <input name="postalCode" maxLength={20} dir="ltr" value={postal} onChange={(e) => setPostal(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("country")}
            <select name="countryCode" required value={country} onChange={(e) => setCountry(e.target.value)} className={input} aria-invalid={bad("countryCode")}>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">{t("city")}
              <input name="city" required maxLength={120} list="city-options" value={city} onChange={(e) => setCity(e.target.value)} className={input} aria-invalid={bad("city")} aria-describedby="city-hint" />
            </label>
            <span id="city-hint" className="text-xs text-muted">{t("cityHint")}</span>
            <datalist id="city-options">{countryCities.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </div>
          <div className="flex items-end lg:col-span-2">
            <button type="button" onClick={find} disabled={finding || address.trim().length < 3 || !city.trim()} data-testid="find-location"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand hover:bg-brand hover:text-brand-ink disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
              {finding ? t("finding") : t("findLocation")}
            </button>
          </div>
        </div>

        <div aria-live="polite">
          {(lookup.status === "not_found" || lookup.status === "unavailable") && (
            <p role="alert" data-testid="geocode-message" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink">{lookup.status === "not_found" ? t("notFound") : t("geocodeUnavailable")}</p>
          )}
          {lookup.status === "hits" && (
            <div data-testid="geocode-hits">
              <p className="mb-2 text-sm font-semibold">{t("suggestions")}</p>
              <ul className="space-y-2">
                {lookup.hits.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1"><bdi>{h.label}</bdi> <span className={`ms-1 text-xs font-semibold ${h.precision === "address" ? "text-[oklch(0.45_0.12_150)]" : "text-brand"}`}>· {t(`precision_${h.precision}`)}</span></span>
                    <button type="button" className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:border-brand hover:text-brand" onClick={() => place(h, "geocoded")}>{t("useSuggestion")}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-sm text-muted">{t("pickerHint")}</p>
        <LocationPicker value={value} fallbackCenter={cityCentre} onPick={(v) => place(v, "manual")} label={t("location")} unavailable={tm("unavailable")} dir={dir} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("latitude")}
            <input name="latitude" inputMode="decimal" dir="ltr" value={lat} onChange={(e) => { setLat(e.target.value); setSource("manual"); setConfirmed(false); }} className={input} aria-invalid={(coordsGiven && !coordsOk) || bad("latitude")} data-testid="lat" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("longitude")}
            <input name="longitude" inputMode="decimal" dir="ltr" value={lng} onChange={(e) => { setLng(e.target.value); setSource("manual"); setConfirmed(false); }} className={input} aria-invalid={(coordsGiven && !coordsOk) || bad("longitude")} data-testid="lng" />
          </label>
        </div>
        {coordsGiven && !coordsOk && <p role="alert" className="text-sm font-semibold text-brand" data-testid="coords-invalid">{t("coordsInvalid")}</p>}
        <input type="hidden" name="coordsSource" value={source} />
        <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
          <input type="checkbox" name="coordsConfirmed" value="1" checked={confirmed} disabled={!coordsOk} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" data-testid="confirm-location" />
          <span><span className="font-semibold">{t("confirm")}</span><br /><span className="text-muted">{t("confirmHint")}</span></span>
        </label>
      </fieldset>

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <legend className="px-1 text-base font-bold">{t("sectionHours")}</legend>
        <p className="text-sm text-muted" id="hours-hint">{t("hoursHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WEEK.map((d) => (
            <label key={d} className="flex flex-col gap-1 text-sm font-semibold">{td(d)}
              <input name={`hours_${d}`} defaultValue={initial.hours?.[d] ?? ""} dir="ltr" maxLength={120} placeholder="09:00–17:00" inputMode="text" autoComplete="off"
                className={input} aria-invalid={bad(`hours_${d}`)} aria-describedby="hours-hint" data-testid={`hours-${d}`} />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionMedia")}</legend>
        <MediaField name="logoUrl" label={t("logo")} initial={initial.logoUrl ?? ""} businessId={initial.id} storageReady={storageReady} invalid={bad("logoUrl")} />
        <MediaField name="coverUrl" label={t("cover")} initial={initial.coverUrl ?? ""} businessId={initial.id} storageReady={storageReady} invalid={bad("coverUrl")} wide />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="save" disabled={saving} className="min-h-11 rounded-xl border border-line bg-surface px-6 text-sm font-bold hover:border-brand hover:text-brand disabled:opacity-60">{t("save")}</button>
        {canPublish ? (
          <button type="submit" name="intent" value="publish" disabled={saving} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("savePublish")}</button>
        ) : (
          <button type="submit" name="intent" value="submit" disabled={saving || initial.status === "pending" || initial.status === "published"} data-testid="submit-review" className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("submitReview")}</button>
        )}
      </div>
    </form>
  );
}
