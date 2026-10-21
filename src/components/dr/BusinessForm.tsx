"use client";

/**
 * Admin create/edit form: business details, address and a confirmed map location. Everything is validated again
 * on the server (saveBusinessAction); this component only helps the admin fill it in correctly.
 *
 * Owners use three steps: information/location, images, then review. All panels stay mounted.
 * Valid draft progress is saved through the existing server action; staff keep the single-page form.
 */
import dynamic from "next/dynamic";
import { useCallback, useActionState, useMemo, useRef, useState, useTransition, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_META, localeSuffix, type Locale } from "@/config/locales";
import { isValidCoordinate } from "@/lib/coordinates";
import type { GeocodeHit } from "@/lib/geocoder-parse";
import { geocodeAction, saveBusinessAction, type BusinessFormState } from "@/app/dr/businesses/actions";
import { WEEK, type WeekDay } from "@/lib/opening-hours";
import { normalizeWhatsapp } from "@/lib/whatsapp";
import { BusinessImageField } from "./BusinessImageField";
import { PhotosField } from "./PhotosField";

const LocationPicker = dynamic(() => import("./LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-[var(--radius-card)] bg-surface-2" aria-hidden="true" />,
});

export type FormCity = { id: string; name: string; names: string[]; countryCode: string; lat: number | null; lng: number | null };
export type FormInitial = {
  id?: string; name?: string; nameCkb?: string; categoryId?: string; description?: string; descriptionCkb?: string;
  phone?: string; whatsapp?: string; email?: string; website?: string; addressLine1?: string; postalCode?: string; city?: string; countryCode?: string;
  latitude?: number | null; longitude?: number | null; coordsSource?: string | null; coordsVerified?: boolean;
  status?: string;
  hours?: Partial<Record<WeekDay, string>>; logoUrl?: string | null; coverUrl?: string | null; photos?: string[];
  /** Description per language (key = locale code; field name is description<Suffix>). */
  translations?: Partial<Record<Locale, string>>;
  languages?: string[];
};

const input = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand aria-[invalid=true]:border-brand";

export function BusinessForm({ initial, categories, countries, cities, canPublish, storageReady, maxPhotos }: {
  initial: FormInitial; categories: { id: string; name: string }[]; countries: { code: string; name: string }[];
  cities: FormCity[]; canPublish: boolean; storageReady: boolean; maxPhotos: number;
}) {
  const t = useTranslations("bizForm");
  const td = useTranslations("days");
  const tm = useTranslations("map");
  const locale = useLocale() as Locale;
  const dir = LOCALE_META[locale].dir;
  const [state, formAction, saving] = useActionState<BusinessFormState, FormData>(saveBusinessAction, undefined);
  const wizard = !canPublish;
  const isDraft = !initial.status || initial.status === "draft";
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewContact, setReviewContact] = useState<string[]>([]);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const attemptedRevision = useRef(0);
  const [dirtyAt, setDirtyAt] = useState(0);
  const [mediaBusy, setMediaBusy] = useState(0);
  const onMediaBusy = useCallback((delta: number) => { setMediaBusy((n) => n + delta); }, []);
  const onMediaChange = useCallback(() => setDirtyAt(Date.now()), []);
  const [categorySearch, setCategorySearch] = useState("");
  const [name, setName] = useState(initial.name ?? "");
  const [wa, setWa] = useState(initial.whatsapp ?? "");
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
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
  const bad = (f: string) => state?.fields?.includes(f) || stepErrors.includes(f) || undefined;
  /** The business as far as it is saved: a draft saved from this form carries its id, so the next save updates it. */
  // Remembered here because a later failed save replaces `state`, and the draft must stay the one being edited.
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [savedAt, setSavedAt] = useState(0);
  if (state?.draft && (state.draft.id !== draftId || state.draft.at !== savedAt)) {
    setDraftId(state.draft.id);
    setSavedAt(state.draft.at);
  }
  const businessId = draftId ?? initial.id;
  const show = (n: number) => !wizard || step === n;
  const unsaved = wizard && dirtyAt > savedAt;

  // Leaving the page with changes that were not saved: the browser asks first.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  useEffect(() => {
    if (!wizard || !isDraft || !unsaved || saving || mediaBusy > 0 || name.trim().length < 2) return;
    const timer = setTimeout(() => {
      if (!formRef.current || attemptedRevision.current >= dirtyAt) return;
      const data = new FormData(formRef.current);
      // Avoid saving partially typed optional fields or half an address/coordinate pair.
      const text = (key: string) => String(data.get(key) ?? "").trim();
      const address = text("addressLine1"), city = text("city");
      if ((address || city) && (address.length < 3 || !city)) return;
      if (Boolean(text("latitude")) !== Boolean(text("longitude"))) return;
      if (text("whatsapp") && !normalizeWhatsapp(text("whatsapp"), text("countryCode")).ok) return;
      if ([...formRef.current.elements].some((el) => el instanceof HTMLInputElement && el.value && !el.validity.valid)) return;
      attemptedRevision.current = dirtyAt;
      data.set("intent", "draft"); data.set("draftRevision", String(dirtyAt));
      startSubmit(() => formAction(data));
    }, 1800);
    return () => clearTimeout(timer);
  }, [wizard, isDraft, unsaved, saving, mediaBusy, name, dirtyAt, formAction, startSubmit]);

  const latNum = lat.trim() === "" ? NaN : Number(lat);
  const lngNum = lng.trim() === "" ? NaN : Number(lng);
  const coordsGiven = lat.trim() !== "" || lng.trim() !== "";
  const coordsOk = isValidCoordinate(latNum, lngNum);
  const value = coordsOk ? { lat: latNum, lng: lngNum } : null;
  const countryCities = cities.filter((c) => c.countryCode === country);
  const cityMatch = useMemo(() => countryCities.find((c) => c.names.some((n) => n.toLocaleLowerCase() === city.trim().toLocaleLowerCase())), [countryCities, city]);
  const cityCentre = cityMatch?.lat != null && cityMatch.lng != null ? { lat: cityMatch.lat, lng: cityMatch.lng } : null;

  const waResult = wa.trim() ? normalizeWhatsapp(wa, country) : null;

  /** What is missing on a step (convenience only: the server checks everything again). */
  function missingOn(n: number): string[] {
    if (n === 1) return [
      ...(name.trim().length < 2 ? ["name"] : []), ...(categoryId ? [] : ["categoryId"]),
      ...(address.trim().length < 3 ? ["addressLine1"] : []), ...(cityMatch ? [] : ["city"]), ...(country ? [] : ["countryCode"]),
      ...(coordsOk && confirmed ? [] : ["latitude"]), ...(waResult && !waResult.ok ? ["whatsapp"] : []),
    ];
    return [];
  }

  function goTo(n: 1 | 2 | 3) {
    if (n === 3 && formRef.current) {
      const data = new FormData(formRef.current);
      setReviewImages([data.get("logoUrl"), data.get("coverUrl"), ...data.getAll("photoUrls")].filter((v): v is string => typeof v === "string" && v.startsWith("https://")));
      setReviewContact([data.get("phone"),data.get("email"),data.get("whatsapp"),data.get("website")].filter((v): v is string => typeof v === "string" && Boolean(v)));
    }
    setStep(n);
    setStepErrors([]);
    formRef.current?.scrollIntoView?.({ block: "start" });
    requestAnimationFrame(() => panelRef.current?.focus());
  }

  function next() {
    const missing = missingOn(step);
    setStepErrors(missing);
    if (missing.length > 0) return;
    // Progress is kept on the server while the listing is still a draft, so a lost connection or a closed tab costs nothing.
    if (isDraft && formRef.current) {
      const data = new FormData(formRef.current);
      data.set("intent", "draft"); data.set("draftRevision", String(dirtyAt));
      startSubmit(() => formAction(data));
    }
    goTo((step + 1) as 2 | 3);
  }

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
      ref={formRef}
      className="space-y-8"
      // The wizard checks each step itself (hidden steps would otherwise block the browser's own validation).
      noValidate={wizard}
      aria-busy={saving}
      onChange={() => setDirtyAt(Date.now())}
      // Dispatch manually (not via the action prop) so a server-side validation error never resets what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        if (mediaBusy > 0) return;
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        data.set("draftRevision", String(dirtyAt));
        if (wizard && data.get("intent") === "submit") {
          const missing = missingOn(1);
          if (missing.length) { goTo(1); setStepErrors(missing); return; }
        }
        startSubmit(() => formAction(data));
      }}
    >
      {businessId && <input type="hidden" name="id" value={businessId} />}
      {wizard && (
        <nav aria-label={t("wizard.steps")}>
          <ol className="flex flex-wrap gap-2 text-sm font-semibold" data-testid="wizard-steps">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} aria-current={step === n ? "step" : undefined} data-testid={`wizard-step-${n}`}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${step === n ? "border-brand bg-brand-soft text-ink" : "border-line text-muted"}`}>
                <span aria-hidden="true" className={`grid size-6 place-items-center rounded-full text-xs font-bold ${step === n ? "bg-brand text-brand-ink" : "bg-surface-2"}`}>{n}</span>
                {t(`wizard.step${n}`)}
              </li>
            ))}
          </ol>
        </nav>
      )}
      {state?.error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink" data-testid="form-error">{t(state.error === "draft_changed" ? "wizard.draftChanged" : state.error === "published_incomplete" ? "publishedIncomplete" : state.error === "unverified" ? "unverifiedEmail" : state.error === "city_unknown" ? "cityUnknown" : state.error === "media_invalid" ? "mediaInvalid" : "invalid")}</p>}
      {stepErrors.length > 0 && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink" data-testid="step-error">{t(stepErrors.includes("latitude") && stepErrors.length === 1 ? "wizard.needPin" : "wizard.fixFields")}</p>}
      {state?.draft && !state.error && !unsaved && <p role="status" className="rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold" data-testid="draft-saved">{t("wizard.draftSaved")}</p>}

      <div ref={panelRef} tabIndex={-1} className="grid gap-8 outline-none">
      <div hidden={!show(1)}>
      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionBasics")}</legend>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("name")}
          <input name="name" required minLength={2} maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={input} aria-invalid={bad("name")} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("nameCkb")}
          <input name="nameCkb" maxLength={200} defaultValue={initial.nameCkb} dir="rtl" className={input} />
        </label>
        <div className="space-y-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("categorySearch")}
          <input type="search" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className={input} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("category")}
          <select
            name="categoryId"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={input}
            aria-invalid={bad("categoryId")}
          >
            <option value="">{t("chooseCategory")}</option>
            {categories.filter((c) => c.id === categoryId || c.name.toLocaleLowerCase().includes(categorySearch.toLocaleLowerCase())).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        </div>
        <details className="sm:col-span-2 rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">{t("optionalDetails")}</summary>
        <label className="mt-3 flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("description")}
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
        </details>
      </fieldset>
      </div>

      <div hidden={!show(1)}>
      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionContact")}</legend>
        <p className="text-xs text-muted sm:col-span-2">{t("publicContactHint")}</p>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("phone")}
          <input name="phone" type="tel" dir="ltr" maxLength={50} defaultValue={initial.phone} className={input} />
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("whatsapp")}
            <input name="whatsapp" type="tel" dir="ltr" maxLength={50} placeholder="+49 178 1234567" value={wa} onChange={(e) => setWa(e.target.value)} className={input}
              aria-invalid={bad("whatsapp") || (waResult && !waResult.ok ? true : undefined)} aria-describedby="whatsapp-hint" data-testid="whatsapp" />
          </label>
          <span id="whatsapp-hint" className={`text-xs ${waResult && !waResult.ok ? "font-semibold text-brand" : "text-muted"}`} data-testid="whatsapp-hint">
            {waResult && !waResult.ok ? t("whatsappInvalid") : waResult?.ok ? t("whatsappSaved", { number: waResult.value }) : t("whatsappHint")}
          </span>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("email")}
          <input name="email" type="email" dir="ltr" maxLength={200} defaultValue={initial.email} className={input} aria-invalid={bad("email")} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{t("website")}
          <input name="website" type="url" dir="ltr" maxLength={300} placeholder="https://" defaultValue={initial.website} className={input} aria-invalid={bad("website")} />
        </label>
      </fieldset>

      </div>

      <div hidden={!show(1)} className="grid gap-8">
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
        {/* Mounted only while its step is on screen: a map created in a hidden box would have no size. */}
        {show(1) && <LocationPicker value={value} fallbackCenter={cityCentre} onPick={(v) => place(v, "manual")} label={t("location")} unavailable={tm("unavailable")} dir={dir} />}

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

      <details open={canPublish} className="rounded-[var(--radius-card)] border border-line bg-surface p-5"><summary className="cursor-pointer text-sm font-semibold">{t("sectionHours")}</summary>
      <fieldset className="mt-3 space-y-4">
        <legend className="sr-only">{t("sectionHours")}</legend>
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
      </details>

      </div>

      <div hidden={!show(2)} className="grid gap-8">
      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-base font-bold">{t("sectionMedia")}</legend>
        <BusinessImageField name="logoUrl" label={t("logo")} initial={initial.logoUrl ?? ""} businessId={businessId} storageReady={storageReady} invalid={bad("logoUrl")} onBusyChange={onMediaBusy} onValueChange={onMediaChange} />
        <BusinessImageField name="coverUrl" label={t("cover")} initial={initial.coverUrl ?? ""} businessId={businessId} storageReady={storageReady} invalid={bad("coverUrl")} wide onBusyChange={onMediaBusy} onValueChange={onMediaChange} />
        <PhotosField label={t("photos")} initial={initial.photos ?? []} max={maxPhotos} businessId={businessId} storageReady={storageReady} onBusyChange={onMediaBusy} onValueChange={onMediaChange} />
      </fieldset>

      </div>
      <div hidden={!show(3)}>
      {wizard && (
        <section aria-labelledby="review-title" className="rounded-[var(--radius-card)] border border-line bg-surface p-5" data-testid="wizard-review">
          <h2 id="review-title" className="mb-3 text-base font-bold">{t("wizard.review")}</h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">{t("name")}</dt><dd className="font-semibold"><bdi>{name}</bdi></dd></div>
            <div><dt className="text-muted">{t("category")}</dt><dd className="font-semibold"><bdi>{categories.find((c) => c.id === categoryId)?.name ?? "—"}</bdi></dd></div>
            <div><dt className="text-muted">{t("address")}</dt><dd className="font-semibold"><bdi>{[address, postal, city, countries.find((c) => c.code === country)?.name].filter(Boolean).join(", ") || "—"}</bdi></dd></div>
            <div><dt className="text-muted">{t("location")}</dt><dd className="font-semibold">{coordsOk && confirmed ? t("wizard.pinConfirmed") : t("wizard.pinMissing")}</dd></div>
          </dl>
          <p className="mt-3 text-sm" dir="auto">{reviewContact.join(" · ")}</p>
          <ul className="mt-4 flex flex-wrap gap-3">{reviewImages.map((url) => <li key={url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-24 rounded-xl border border-line bg-surface-2 object-contain" />
          </li>)}</ul>
          <p className="mt-3 text-xs text-muted">{t("wizard.reviewHint")}</p>
        </section>
      )}
      </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {wizard && step > 1 && (
          <button type="button" onClick={() => goTo((step - 1) as 1 | 2)} disabled={saving || mediaBusy > 0} data-testid="wizard-back" className="min-h-11 rounded-xl border border-line bg-surface px-6 text-sm font-bold hover:border-brand hover:text-brand disabled:opacity-60">{t("wizard.back")}</button>
        )}
        {wizard && step < 3 && (
          <button type="button" onClick={next} disabled={saving || mediaBusy > 0} data-testid="wizard-next" className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("wizard.next")}</button>
        )}
        <button type="submit" name="intent" value={wizard && isDraft ? "draft" : "save"} disabled={saving || mediaBusy > 0 || (wizard && isDraft && name.trim().length < 2)} data-testid={wizard && isDraft ? "save-draft" : "save"} className="min-h-11 rounded-xl border border-line bg-surface px-6 text-sm font-bold hover:border-brand hover:text-brand disabled:opacity-60">{wizard && isDraft ? t("wizard.saveDraft") : t("save")}</button>
        {canPublish ? (
          <button type="submit" name="intent" value="publish" disabled={saving || mediaBusy > 0} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("savePublish")}</button>
        ) : (!wizard || step === 3) && (
          <button type="submit" name="intent" value="submit" disabled={saving || mediaBusy > 0 || initial.status === "pending" || initial.status === "published"} data-testid="submit-review" className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("submitReview")}</button>
        )}
      </div>
    </form>
  );
}
