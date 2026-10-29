"use client";

/**
 * Create/edit form: business details, contact and social profiles, address with a confirmed map location, opening
 * hours and four images (logo + three promotional images). Everything is validated again on the server
 * (saveBusinessAction); this component only helps to fill it in correctly.
 *
 * Owners use five steps (basics, contact, location, hours, images & review). All panels stay mounted, so nothing typed
 * is lost when moving between steps. Valid draft progress is saved through the existing server action; staff who
 * publish keep the same sections on a single page.
 */
import dynamic from "next/dynamic";
import { useCallback, useActionState, useMemo, useRef, useState, useTransition, useEffect, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_META, localeSuffix, type Locale } from "@/config/locales";
import { isValidCoordinate } from "@/lib/coordinates";
import type { GeocodeHit } from "@/lib/geocoder-parse";
import { geocodeAction, saveBusinessAction, type BusinessFormState } from "@/app/dr/businesses/actions";
import { WEEK, normalizeDay, type HoursException, type WeekDay } from "@/lib/opening-hours";
import { normalizeWhatsapp } from "@/lib/whatsapp";
import { SOCIAL_FIELD, SOCIAL_PLATFORMS, normalizeSocialUrl, normalizeWebsite, type SocialPlatform } from "@/lib/social-links";
import { SOCIAL_ICONS, SocialIcon } from "@/components/business/SocialIcon";
import { BusinessImageField } from "./BusinessImageField";
import { PhotosField } from "./PhotosField";
import { HoursExceptionsEditor } from "./HoursExceptionsEditor";
import { OpeningHoursEditor } from "./OpeningHoursEditor";

const LocationPicker = dynamic(() => import("./LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-[var(--radius-card)] bg-surface-2" aria-hidden="true" />,
});

export type FormCity = { id: string; name: string; names: string[]; countryCode: string; lat: number | null; lng: number | null };
export type FormInitial = {
  id?: string; name?: string; nameCkb?: string; categoryId?: string; description?: string; descriptionCkb?: string;
  phone?: string; whatsapp?: string; email?: string; website?: string; addressLine1?: string; postalCode?: string; city?: string; countryCode?: string;
  social?: Partial<Record<SocialPlatform, string>>;
  latitude?: number | null; longitude?: number | null; coordsSource?: string | null; coordsVerified?: boolean;
  status?: string;
  hours?: Partial<Record<WeekDay, string>>; holidaysClosed?: boolean; hoursExceptions?: HoursException[]; logoUrl?: string | null; coverUrl?: string | null; photos?: string[];
  /** Description per language (key = locale code; field name is description<Suffix>). */
  translations?: Partial<Record<Locale, string>>;
  languages?: string[];
};

const STEPS = [1, 2, 3, 4, 5] as const;
type Step = (typeof STEPS)[number];

const input = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand aria-[invalid=true]:border-brand";
const fieldLabel = "flex flex-col gap-1.5 text-sm font-semibold";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Section icons (24px line icons, currentColor). */
const ICONS: Record<"basics" | "contact" | "location" | "hours" | "media" | "social", ReactNode> = {
  basics: <><path d="M4 9h16l-1.5-5h-13z" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
  contact: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  location: <><path d="M12 22s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  hours: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  media: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>,
  social: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
};

function Section({ icon, title, hint, id, children }: { icon: keyof typeof ICONS; title: string; hint?: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-extrabold leading-tight">{title}</h2>
          {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Visible "required" star / "optional" tag; both decorative (the inputs carry `required`), so field names stay plain. */
function Mark({ required, optional }: { required?: boolean; optional?: string }) {
  if (required) return <span aria-hidden="true" className="ms-1 text-brand">*</span>;
  return optional ? <span aria-hidden="true" className="ms-1 text-xs font-normal text-muted">({optional})</span> : null;
}

export function BusinessForm({ initial, categories, countries, cities, canPublish, storageReady, maxPhotos }: {
  initial: FormInitial; categories: { id: string; name: string }[]; countries: { code: string; name: string }[];
  cities: FormCity[]; canPublish: boolean; storageReady: boolean; maxPhotos: number;
}) {
  const t = useTranslations("bizForm");
  const tm = useTranslations("map");
  const td = useTranslations("days");
  const tbi = useTranslations("businessImages");
  const locale = useLocale() as Locale;
  const dir = LOCALE_META[locale].dir;
  const [state, formAction, saving] = useActionState<BusinessFormState, FormData>(saveBusinessAction, undefined);
  const wizard = !canPublish;
  const isDraft = !initial.status || initial.status === "draft";
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(1);
  // A listing that already exists can be opened at any step; a new one is filled in order.
  const [reached, setReached] = useState<Step>(initial.id ? 5 : 1);
  const [review, setReview] = useState<{ images: string[]; hours: [WeekDay, string][] }>({ images: [], hours: [] });
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const attemptedRevision = useRef(0);
  const [dirtyAt, setDirtyAt] = useState(0);
  const [mediaBusy, setMediaBusy] = useState(0);
  const onMediaBusy = useCallback((delta: number) => { setMediaBusy((n) => n + delta); }, []);
  const markDirty = useCallback(() => setDirtyAt(Date.now()), []);
  const [categorySearch, setCategorySearch] = useState("");
  const [name, setName] = useState(initial.name ?? "");
  const [wa, setWa] = useState(initial.whatsapp ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [social, setSocial] = useState<Record<SocialPlatform, string>>(() => Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, initial.social?.[p] ?? ""])) as Record<SocialPlatform, string>);
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
  const show = (n: Step) => !wizard || step === n;
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
      if (!normalizeWebsite(text("website")).ok || SOCIAL_PLATFORMS.some((p) => !normalizeSocialUrl(p, text(SOCIAL_FIELD[p])).ok)) return;
      if (WEEK.some((d) => normalizeDay(text(`hours_${d}`)) === null)) return;
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
  const emailBad = email.trim() !== "" && !EMAIL.test(email.trim());
  const websiteResult = normalizeWebsite(website);
  const socialBad = (p: SocialPlatform) => !normalizeSocialUrl(p, social[p]).ok;

  /** What is missing on a step (convenience only: the server checks everything again). */
  function missingOn(n: Step): string[] {
    if (n === 1) return [...(name.trim().length < 2 ? ["name"] : []), ...(categoryId ? [] : ["categoryId"])];
    if (n === 2) return [
      ...(waResult && !waResult.ok ? ["whatsapp"] : []), ...(emailBad ? ["email"] : []), ...(websiteResult.ok ? [] : ["website"]),
      ...SOCIAL_PLATFORMS.filter(socialBad).map((p) => SOCIAL_FIELD[p]),
    ];
    if (n === 3) return [
      ...(address.trim().length < 3 ? ["addressLine1"] : []), ...(cityMatch ? [] : ["city"]), ...(country ? [] : ["countryCode"]),
      ...(coordsOk && confirmed ? [] : ["latitude"]),
    ];
    if (n === 4 && formRef.current) {
      const data = new FormData(formRef.current);
      return WEEK.filter((d) => normalizeDay(String(data.get(`hours_${d}`) ?? "")) === null).map((d) => `hours_${d}`);
    }
    return [];
  }

  function goTo(n: Step) {
    if (n === 5 && formRef.current) {
      const data = new FormData(formRef.current);
      setReview({
        images: [data.get("logoUrl"), data.get("coverUrl"), ...data.getAll("photoUrls")].filter((v): v is string => typeof v === "string" && v.startsWith("https://")),
        hours: WEEK.map((d) => [d, String(data.get(`hours_${d}`) ?? "")] as [WeekDay, string]).filter(([, v]) => v),
      });
    }
    setStep(n);
    setReached((r) => (n > r ? n : r));
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
    goTo((step + 1) as Step);
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

  const stepNames: Record<Step, string> = { 1: t("wizard.step1"), 2: t("wizard.step2"), 3: t("wizard.step3"), 4: t("wizard.step4"), 5: t("wizard.step5") };
  const busy = saving || mediaBusy > 0;
  const primaryButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-base font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60";
  const secondaryButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 text-base font-bold hover:border-brand hover:text-brand disabled:opacity-60";
  const optional = t("optional");

  return (
    <form
      ref={formRef}
      className="space-y-6"
      // The wizard checks each step itself (hidden steps would otherwise block the browser's own validation).
      noValidate={wizard}
      aria-busy={saving}
      onChange={markDirty}
      // Dispatch manually (not via the action prop) so a server-side validation error never resets what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        if (mediaBusy > 0) return;
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        data.set("draftRevision", String(dirtyAt));
        if (wizard && data.get("intent") === "submit") {
          for (const n of [1, 2, 3, 4] as const) {
            const missing = missingOn(n);
            if (missing.length) { goTo(n); setStepErrors(missing); return; }
          }
        }
        startSubmit(() => formAction(data));
      }}
    >
      {businessId && <input type="hidden" name="id" value={businessId} />}
      {wizard && (
        <nav aria-label={t("wizard.steps")} className="rounded-[var(--radius-card)] border border-line bg-surface px-2 py-4 sm:px-4">
          <ol className="grid grid-cols-5" data-testid="wizard-steps">
            {STEPS.map((n) => {
              const done = n < step;
              const current = step === n;
              const reachable = n <= reached && !current && !busy;
              const dot = (
                <>
                  <span aria-hidden="true" className={`relative z-10 grid size-9 place-items-center rounded-full text-sm font-bold ring-4 ring-surface ${current || done ? "bg-brand text-brand-ink" : "border border-line bg-surface-2 text-muted"}`}>
                    {done ? <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg> : n}
                  </span>
                  <span className={`mt-1.5 text-center text-[0.7rem] leading-tight sm:text-xs ${current ? "font-bold text-ink" : "font-semibold text-muted"}`}>{stepNames[n]}</span>
                  {done && <span className="sr-only"> ({t("wizard.completed")})</span>}
                </>
              );
              return (
                <li key={n} aria-current={current ? "step" : undefined} data-testid={`wizard-step-${n}`}
                  className={`relative flex min-w-0 flex-col items-center px-0.5 ${n < 5 ? `after:absolute after:top-[1.125rem] after:start-1/2 after:h-0.5 after:w-full ${done ? "after:bg-brand" : "after:bg-line"}` : ""}`}>
                  {reachable
                    ? <button type="button" onClick={() => goTo(n)} className="flex flex-col items-center rounded-lg focus-visible:outline-2 focus-visible:outline-brand">{dot}</button>
                    : <div className="flex flex-col items-center">{dot}</div>}
                </li>
              );
            })}
          </ol>
          <p className="sr-only" aria-live="polite">{t("wizard.stepOf", { n: step, total: STEPS.length, name: stepNames[step] })}</p>
        </nav>
      )}
      {state?.error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink" data-testid="form-error">{t(state.error === "draft_changed" ? "wizard.draftChanged" : state.error === "published_incomplete" ? "publishedIncomplete" : state.error === "unverified" ? "unverifiedEmail" : state.error === "city_unknown" ? "cityUnknown" : state.error === "media_invalid" ? "mediaInvalid" : "invalid")}</p>}
      {stepErrors.length > 0 && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-ink" data-testid="step-error">{t(stepErrors.includes("latitude") && stepErrors.length === 1 ? "wizard.needPin" : "wizard.fixFields")}</p>}
      {state?.draft && !state.error && !unsaved && <p role="status" className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold" data-testid="draft-saved">
        <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-[oklch(0.45_0.12_150)]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
        {t("wizard.draftSaved")}</p>}

      <div ref={panelRef} tabIndex={-1} className="grid gap-6 outline-none">
      {/* 1 — Business information */}
      <div hidden={!show(1)}>
      <Section icon="basics" id="sec-basics" title={t("titleBasics")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={fieldLabel}><span><label htmlFor="f-name">{t("name")}</label><Mark required /></span>
            <input id="f-name" name="name" required minLength={2} maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={input} aria-invalid={bad("name")} autoComplete="organization" />
          </div>
          <label className={fieldLabel}><span>{t("nameCkb")}</span>
            <input name="nameCkb" maxLength={200} defaultValue={initial.nameCkb} dir="rtl" className={input} />
          </label>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <div className={fieldLabel}><span><label htmlFor="f-category">{t("category")}</label><Mark required /></span>
              <select id="f-category" name="categoryId" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input} aria-invalid={bad("categoryId")}>
                <option value="">{t("chooseCategory")}</option>
                {categories.filter((c) => c.id === categoryId || c.name.toLocaleLowerCase().includes(categorySearch.toLocaleLowerCase())).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <label className={fieldLabel}><span className="text-muted">{t("categorySearch")}</span>
              <input type="search" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className={input} autoComplete="off" />
            </label>
          </div>
        </div>
        <details className="group rounded-xl border border-line" open={Boolean(initial.description) || LOCALES.some((l) => initial.translations?.[l]) || Boolean(initial.languages?.length)}>
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 text-sm font-semibold">{t("optionalDetails")}
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <div className="space-y-4 border-t border-line p-4">
            <label className={fieldLabel}>{t("description")}
              <textarea name="description" rows={4} maxLength={8000} defaultValue={initial.description} className={`${input} py-2`} />
            </label>
            <details className="rounded-xl bg-surface-2 px-4 py-3" open={LOCALES.some((l) => initial.translations?.[l])}>
              <summary className="cursor-pointer text-sm font-semibold">{t("translations")}</summary>
              <p className="mt-2 text-xs text-muted">{t("translationsHint")}</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {LOCALES.map((l) => (
                  <label key={l} className={fieldLabel} lang={LOCALE_META[l].htmlLang}>
                    <span>{t("descriptionIn", { language: LOCALE_META[l].nativeName })}</span>
                    <textarea name={`description${localeSuffix(l)}`} rows={3} maxLength={8000} dir={LOCALE_META[l].dir} defaultValue={initial.translations?.[l] ?? ""} className={`${input} py-2`} />
                  </label>
                ))}
              </div>
            </details>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t("languagesSpoken")}</legend>
              <div className="flex flex-wrap gap-2">
                {LOCALES.map((l) => (
                  <label key={l} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                    <input type="checkbox" name="languages" value={l} defaultChecked={initial.languages?.includes(l)} className="size-4 accent-[var(--brand)]" />
                    <span lang={LOCALE_META[l].htmlLang}>{LOCALE_META[l].nativeName}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </details>
      </Section>
      </div>

      {/* 2 — Contact information and social media (all optional) */}
      <div hidden={!show(2)} className="grid gap-6">
      <Section icon="contact" id="sec-contact" title={t("titleContact")} hint={t("publicContactHint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={fieldLabel}><span><label htmlFor="f-phone">{t("phone")}</label><Mark optional={optional} /></span>
            <input id="f-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={50} placeholder="+49 30 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold"><label htmlFor="f-whatsapp">{t("whatsapp")}</label><Mark optional={optional} /></span>
            <div className="relative">
              <input id="f-whatsapp" name="whatsapp" type="tel" inputMode="tel" dir="ltr" maxLength={50} placeholder="+49 178 1234567" value={wa} onChange={(e) => setWa(e.target.value)} className={`${input} pe-24`}
                aria-invalid={bad("whatsapp") || (waResult && !waResult.ok ? true : undefined)} aria-describedby="whatsapp-hint" data-testid="whatsapp" />
              {!wa && phone.trim() && (
                <button type="button" onClick={() => { setWa(phone); markDirty(); }} className="absolute inset-y-1 end-1 rounded-lg px-2 text-xs font-semibold text-brand hover:bg-brand-soft" data-testid="whatsapp-from-phone">{t("sameAsPhone")}</button>
              )}
            </div>
            <span id="whatsapp-hint" className={`text-xs ${waResult && !waResult.ok ? "font-semibold text-brand" : "text-muted"}`} data-testid="whatsapp-hint">
              {waResult && !waResult.ok ? t("whatsappInvalid") : waResult?.ok ? t("whatsappSaved", { number: waResult.value }) : t("whatsappHint")}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className={fieldLabel}><span><label htmlFor="f-email">{t("email")}</label><Mark optional={optional} /></span>
              <input id="f-email" name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" maxLength={200} placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input}
                aria-invalid={bad("email") || (emailBad ? true : undefined)} aria-describedby={emailBad ? "email-error" : undefined} data-testid="email" />
            </div>
            {emailBad && <span id="email-error" className="text-xs font-semibold text-brand">{t("emailInvalid")}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className={fieldLabel}><span><label htmlFor="f-website">{t("website")}</label><Mark optional={optional} /></span>
              <input id="f-website" name="website" type="text" inputMode="url" autoComplete="url" dir="ltr" maxLength={300} placeholder="https://example.com" value={website} onChange={(e) => setWebsite(e.target.value)} className={input}
                aria-invalid={bad("website") || (!websiteResult.ok ? true : undefined)} aria-describedby={!websiteResult.ok ? "website-error" : undefined} data-testid="website" />
            </div>
            {!websiteResult.ok && <span id="website-error" className="text-xs font-semibold text-brand">{t("websiteInvalid")}</span>}
          </div>
        </div>
      </Section>
      <Section icon="social" id="sec-social" title={t("titleSocial")} hint={t("socialHint")}>
        <ul className="space-y-3" data-testid="social-fields">
          {SOCIAL_PLATFORMS.map((p) => {
            const field = SOCIAL_FIELD[p];
            const invalid = socialBad(p) || bad(field);
            const title = SOCIAL_ICONS[p].title;
            return (
              <li key={p} className="flex items-start gap-3">
                <SocialIcon platform={p} className="mt-7 size-11" />
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold"><label htmlFor={`f-${field}`} dir="ltr">{title}</label><Mark optional={optional} /></span>
                  <div className="relative mt-1.5">
                    <input id={`f-${field}`} name={field} type="text" inputMode="url" dir="ltr" maxLength={300} autoComplete="off" spellCheck={false}
                      placeholder={p === "facebook" ? "https://facebook.com/…" : p === "instagram" ? "https://instagram.com/…" : p === "tiktok" ? "https://tiktok.com/@…" : "https://snapchat.com/add/…"}
                      value={social[p]} onChange={(e) => setSocial((s) => ({ ...s, [p]: e.target.value }))} className={`${input} pe-12`}
                      aria-invalid={invalid || undefined} aria-describedby={invalid ? `${field}-error` : undefined} data-testid={`social-${p}`} />
                    {social[p] && (
                      <button type="button" onClick={() => { setSocial((s) => ({ ...s, [p]: "" })); markDirty(); }} aria-label={t("socialClear", { platform: title })}
                        className="absolute inset-y-1 end-1 grid w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-brand" data-testid={`social-clear-${p}`}>
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    )}
                  </div>
                  {invalid && <p id={`${field}-error`} className="mt-1 text-xs font-semibold text-brand" data-testid={`social-error-${p}`}>{t("socialInvalid", { platform: title })}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      </div>

      {/* 3 — Location */}
      <div hidden={!show(3)}>
      <Section icon="location" id="sec-location" title={t("titleLocation")} hint={t("locationHint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={fieldLabel}><span><label htmlFor="f-country">{t("country")}</label><Mark required /></span>
            <select id="f-country" name="countryCode" required value={country} onChange={(e) => setCountry(e.target.value)} className={input} aria-invalid={bad("countryCode")} autoComplete="country">
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className={fieldLabel}><span><label htmlFor="f-city">{t("city")}</label><Mark required /></span>
              <input id="f-city" name="city" required maxLength={120} list="city-options" value={city} onChange={(e) => setCity(e.target.value)} className={input} aria-invalid={bad("city")} aria-describedby="city-hint" autoComplete="address-level2" />
            </div>
            <span id="city-hint" className="text-xs text-muted">{t("cityHint")}</span>
            <datalist id="city-options">{countryCities.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </div>
          <div className={fieldLabel}><span><label htmlFor="f-address">{t("address")}</label><Mark required /></span>
            <input id="f-address" name="addressLine1" required minLength={3} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} className={input} aria-invalid={bad("addressLine1")} autoComplete="address-line1" />
          </div>
          <div className={fieldLabel}><span><label htmlFor="f-postalCode">{t("postalCode")}</label><Mark optional={optional} /></span>
            <input id="f-postalCode" name="postalCode" maxLength={20} dir="ltr" inputMode="text" value={postal} onChange={(e) => setPostal(e.target.value)} className={input} autoComplete="postal-code" />
          </div>
          <button type="button" onClick={find} disabled={finding || address.trim().length < 3 || !city.trim()} data-testid="find-location"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand hover:bg-brand hover:text-brand-ink disabled:opacity-50 sm:col-span-2">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
            {finding ? t("finding") : t("findLocation")}
          </button>
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
                    <span className="flex min-w-0 flex-1 items-start gap-2">
                      <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{ICONS.location}</svg>
                      <span><bdi>{h.label}</bdi> <span className={`ms-1 text-xs font-semibold ${h.precision === "address" ? "text-[oklch(0.45_0.12_150)]" : "text-brand"}`}>· {t(`precision_${h.precision}`)}</span></span>
                    </span>
                    <button type="button" className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold hover:border-brand hover:text-brand" onClick={() => place(h, "geocoded")}>{t("useSuggestion")}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-sm text-muted">{t("pickerHint")}</p>
        {/* Mounted only while its step is on screen: a map created in a hidden box would have no size. */}
        {show(3) && <LocationPicker value={value} fallbackCenter={cityCentre} onPick={(v) => place(v, "manual")} label={t("location")} unavailable={tm("unavailable")} dir={dir} />}

        <input type="hidden" name="coordsSource" value={source} />
        <label className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${coordsOk && confirmed ? "border-[oklch(0.45_0.12_150)] bg-surface-2" : "border-line bg-surface-2"}`}>
          <input type="checkbox" name="coordsConfirmed" value="1" checked={confirmed} disabled={!coordsOk} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" data-testid="confirm-location" />
          <span><span className="font-semibold">{t("confirm")}</span><br /><span className="text-muted">{t("confirmHint")}</span></span>
        </label>
        {coordsOk && confirmed && (
          <p role="status" className="flex items-center gap-3 rounded-xl border border-[oklch(0.45_0.12_150)] px-4 py-3 text-sm" data-testid="location-confirmed">
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[oklch(0.45_0.12_150)] text-white">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
            </span>
            <span><span className="font-bold text-[oklch(0.4_0.12_150)]">{t("pinConfirmedTitle")}</span><br /><span className="text-muted">{t("pinConfirmedText")}</span></span>
          </p>
        )}

        <details className="rounded-xl border border-line" open={canPublish || (coordsGiven && !coordsOk)}>
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">{t("advancedCoords")}</summary>
          <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
            <label className={fieldLabel}>{t("latitude")}
              <input name="latitude" inputMode="decimal" dir="ltr" value={lat} onChange={(e) => { setLat(e.target.value); setSource("manual"); setConfirmed(false); }} className={input} aria-invalid={(coordsGiven && !coordsOk) || bad("latitude")} data-testid="lat" />
            </label>
            <label className={fieldLabel}>{t("longitude")}
              <input name="longitude" inputMode="decimal" dir="ltr" value={lng} onChange={(e) => { setLng(e.target.value); setSource("manual"); setConfirmed(false); }} className={input} aria-invalid={(coordsGiven && !coordsOk) || bad("longitude")} data-testid="lng" />
            </label>
            {coordsGiven && !coordsOk && <p role="alert" className="text-sm font-semibold text-brand sm:col-span-2" data-testid="coords-invalid">{t("coordsInvalid")}</p>}
          </div>
        </details>
      </Section>
      </div>

      {/* 4 — Opening hours */}
      <div hidden={!show(4)}>
      <Section icon="hours" id="sec-hours" title={t("sectionHours")} hint={t("hoursEditor.hint")}>
        <OpeningHoursEditor initial={initial.hours ?? {}} invalidDays={[...(state?.fields ?? []), ...stepErrors]} onChange={markDirty} />
        <details className="rounded-xl border border-line" open={canPublish || Boolean(initial.holidaysClosed || initial.hoursExceptions?.length) || bad("hoursExceptions")}>
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">{t("exceptionsTitle")}</summary>
          <div className="border-t border-line p-4">
            <HoursExceptionsEditor initial={initial.hoursExceptions ?? []} holidaysClosed={Boolean(initial.holidaysClosed)} invalid={bad("hoursExceptions")} />
          </div>
        </details>
      </Section>
      </div>

      {/* 5 — Logo and three promotional images, then (owners) review and submit */}
      <div hidden={!show(5)} className="grid gap-6">
      <Section icon="media" id="sec-media" title={t("titleMedia")} hint={t("media.hint")}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <BusinessImageField name="logoUrl" label={t("logo")} addLabel={t("media.uploadLogo")} initial={initial.logoUrl ?? ""} businessId={businessId} storageReady={storageReady} invalid={bad("logoUrl")} onBusyChange={onMediaBusy} onValueChange={markDirty} />
          <BusinessImageField name="coverUrl" label={t("media.promo", { n: 1 })} addLabel={t("media.addPhoto")} initial={initial.coverUrl ?? ""} businessId={businessId} storageReady={storageReady} invalid={bad("coverUrl")} wide onBusyChange={onMediaBusy} onValueChange={markDirty} />
        </div>
        <PhotosField label={t("media.morePhotos")} slotLabel={(i) => t("media.promo", { n: i + 2 })} initial={initial.photos ?? []} max={maxPhotos} businessId={businessId} storageReady={storageReady} onBusyChange={onMediaBusy} onValueChange={markDirty} />
        <p className="text-xs text-muted">{tbi("formats")}</p>
      </Section>

      {wizard && (
        <section aria-labelledby="review-title" className="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" data-testid="wizard-review">
          <h2 id="review-title" className="text-lg font-extrabold">{t("wizard.review")}</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {([
              [1, t("name"), name || "—"],
              [1, t("category"), categories.find((c) => c.id === categoryId)?.name ?? "—"],
              [2, t("titleContact"), [phone, wa, email, website].map((v) => v.trim()).filter(Boolean).join(" · ") || "—"],
              [2, t("titleSocial"), SOCIAL_PLATFORMS.filter((p) => social[p].trim()).map((p) => SOCIAL_ICONS[p].title).join(" · ") || "—"],
              [3, t("address"), [address, postal, city, countries.find((c) => c.code === country)?.name].filter(Boolean).join(", ") || "—"],
              [3, t("location"), coordsOk && confirmed ? t("wizard.pinConfirmed") : t("wizard.pinMissing")],
              [4, t("sectionHours"), review.hours.length ? review.hours.map(([d, v]) => `${td(d)} ${v === "closed" ? t("hoursEditor.closed") : v}`).join(" · ") : t("hoursEditor.unknown")],
            ] as [Step, string, string][]).map(([n, label, text], i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="font-semibold" dir="auto"><bdi>{text}</bdi></dd></div>
                <button type="button" onClick={() => goTo(n)} disabled={busy} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-brand hover:bg-brand-soft">{t("edit")}<span className="sr-only"> – {label}</span></button>
              </div>
            ))}
          </dl>
          {review.images.length > 0 && <ul className="flex flex-wrap gap-3">{review.images.map((url) => <li key={url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-20 rounded-xl border border-line bg-surface-2 object-cover" />
          </li>)}</ul>}
          <p className="text-xs text-muted">{t("wizard.reviewHint")}</p>
        </section>
      )}
      </div>
      </div>

      <div className="space-y-3">
        {wizard && (
          <div className="grid grid-cols-2 gap-3">
            {step > 1
              ? <button type="button" onClick={() => goTo((step - 1) as Step)} disabled={busy} data-testid="wizard-back" className={secondaryButton}>
                  <svg viewBox="0 0 24 24" className="rtl-flip size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg>{t("wizard.back")}</button>
              : <span />}
            {step < 5
              ? <button type="button" onClick={next} disabled={busy} data-testid="wizard-next" className={primaryButton}>{t("wizard.next")}
                  <svg viewBox="0 0 24 24" className="rtl-flip size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
              : <button type="submit" name="intent" value="submit" disabled={busy || initial.status === "pending" || initial.status === "published"} data-testid="submit-review" className={primaryButton}>{t("submitReview")}</button>}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="intent" value={wizard && isDraft ? "draft" : "save"} disabled={busy || (wizard && isDraft && name.trim().length < 2)} data-testid={wizard && isDraft ? "save-draft" : "save"}
            className={wizard && isDraft ? "inline-flex min-h-11 items-center px-1 text-sm font-bold text-muted underline-offset-4 hover:text-brand hover:underline disabled:opacity-60" : secondaryButton}>
            {saving ? t("saving") : wizard && isDraft ? t("wizard.saveDraft") : t("save")}
          </button>
          {canPublish && <button type="submit" name="intent" value="publish" disabled={busy} className={primaryButton}>{t("savePublish")}</button>}
        </div>
      </div>
    </form>
  );
}
