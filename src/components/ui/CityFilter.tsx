"use client";

/**
 * Location selector (search first). One compact field that opens a panel: a popover on large screens, a bottom sheet
 * on phones. Inside: search, optional "use my location", then country -> region -> city, each step shown only when
 * the data has more than one choice. Cities come from /api/v1/geo in small bounded lists, never the whole gazetteer.
 *
 * It keeps the form contract of the control it replaces: a hidden <select id="f-city" name="city"> carries the chosen
 * city id (with the bounded option list, labels and counts) so every GET form that embeds it keeps working.
 * The chosen place is saved in this browser only and shared with the other selectors, the business lists and the map.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import { countryFlag, countryName, localize, type Localized } from "@/lib/content";
import { coarsen } from "@/lib/geo";
import { plainCityName, rankByQuery, savedCityQuery } from "@/lib/location-pref";
import {
  clearSavedLocation,
  fetchGeoCity,
  fetchGeoList,
  fetchNearestGeoCity,
  getSavedLocation,
  saveLocation,
  subscribeSavedLocation,
  type GeoCity,
  type GeoList,
  type GeoNames,
} from "@/lib/location-store";
import { Text } from "@/components/ui/Bidi";

type Option = { id: string; label: string; /** Plain name without a count; defaults to the label. */ name?: string };

type Props = {
  /** The bounded option list the page already has (labels may carry a count). Shown instantly, before the panel loads. */
  cities: Option[];
  /** The city in the address: undefined = none chosen there, "" = all cities on purpose. */
  value?: string;
  allLabel: string;
  cityLabel: string;
  fieldClass: string;
  /** List pages: a saved place is added to the address when the visitor arrives without choosing one. */
  applySavedToUrl?: boolean;
  /** Directory country scope; other consumers retain the current default. */
  countryCode?: string;
  /** Hide the built-in chevron when the parent draws its own. */
  chevron?: boolean;
};

type Picked = { id: string; name: string; countryCode: string | null; regionId: string | null };
type Locating = "busy" | "denied" | "unavailable" | "unsupported" | "none" | null;

const nameOf = (row: GeoNames, locale: Locale): Localized => localize({ ...row, name: row.nameEn }, "name", locale);
const pickedFrom = (city: GeoCity, locale: Locale): Picked => ({ id: city.id, name: nameOf(city, locale).text, countryCode: city.countryCode, regionId: city.regionId });

export function CityFilter({ cities, value, allLabel, cityLabel, fieldClass, applySavedToUrl = false, chevron = true, countryCode }: Props) {
  const t = useTranslations("locationPicker");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const uid = useId();
  const panelId = `${uid}-panel`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const saved = useSyncExternalStore(subscribeSavedLocation, getSavedLocation, () => null);
  const [picked, setPicked] = useState<Picked | null | undefined>(undefined);
  const [fetched, setFetched] = useState<Picked | null>(null);

  // What is chosen: the visitor's pick in this page, else the city in the address, else the saved place.
  const chosenId = picked !== undefined ? (picked?.id ?? "") : value !== undefined ? value : (saved?.cityId ?? "");
  const listed = cities.find((c) => c.id === chosenId);
  const shownName = !chosenId ? "" : picked?.id === chosenId ? picked.name : listed ? plainCityName(listed) : fetched?.id === chosenId ? fetched.name : "";

  // A chosen city outside the bounded list (found by search, saved earlier or shared in a link) gets its name from the API.
  useEffect(() => {
    if (!chosenId || listed || picked?.id === chosenId) return;
    let live = true;
    fetchGeoCity(chosenId)
      .then((city) => {
        if (!live) return;
        if (city) setFetched(pickedFrom(city, locale));
        else if (picked === undefined && value === undefined) clearSavedLocation(); // the saved city no longer exists
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [chosenId, listed, picked, value, locale]);

  // List pages share the saved place: arriving without a city in the address applies it; "all cities" on purpose clears it.
  useEffect(() => {
    if (!applySavedToUrl) return;
    if (value === "") {
      clearSavedLocation();
      return;
    }
    if (value !== undefined) return;
    const pref = getSavedLocation();
    const query = savedCityQuery(window.location.search, pref);
    if (!pref || !query) return;
    let live = true;
    fetchGeoCity(pref.cityId)
      .then((city) => {
        if (!live) return;
        if (city) router.replace(`${window.location.pathname}?${query}`, { scroll: false });
        else clearSavedLocation();
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [applySavedToUrl, value, router]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const choose = useCallback(
    (city: Picked | null) => {
      setPicked(city);
      if (city) saveLocation({ cityId: city.id, countryCode: city.countryCode, regionId: city.regionId });
      else clearSavedLocation();
      close(true);
    },
    [close],
  );

  const extraOption = chosenId && !listed && shownName ? <option value={chosenId}>{shownName}</option> : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        id="f-city-search"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${cityLabel}: ${shownName || allLabel}`}
        onClick={() => setOpen((o) => !o)}
        className={`${fieldClass} flex cursor-pointer items-center justify-between gap-2 text-start`}
      >
        <span className={`min-w-0 flex-1 truncate ${shownName ? "" : "text-muted"}`}>{shownName ? <bdi>{shownName}</bdi> : allLabel}</span>
        {chevron && <span aria-hidden="true" className="shrink-0 text-muted">⌄</span>}
      </button>

      {/* The value the surrounding GET form submits. The visible control above is the one assistive technology uses. */}
      <select id="f-city" name="city" aria-hidden="true" tabIndex={-1} value={chosenId} onChange={() => {}} className="sr-only">
        <option value="">{allLabel}</option>
        {extraOption}
        {cities.map((city) => <option key={city.id} value={city.id}>{city.label}</option>)}
      </select>

      {open && (
        <LocationPanel
          countryCode={countryCode}
          panelId={panelId}
          anchorRef={buttonRef}
          fallback={cities}
          selectedId={chosenId}
          title={t("title")}
          allLabel={allLabel}
          cityLabel={cityLabel}
          locale={locale}
          onChoose={choose}
          onClose={close}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the panel

type PanelProps = {
  countryCode?: string;
  panelId: string;
  anchorRef: RefObject<HTMLButtonElement | null>;
  fallback: Option[];
  selectedId: string;
  title: string;
  allLabel: string;
  cityLabel: string;
  locale: Locale;
  onChoose: (city: Picked | null) => void;
  onClose: (returnFocus: boolean) => void;
};

type Row = { id: string; text: string; localized?: Localized; count?: number; picked: Picked | null; names?: (string | null | undefined)[] };

function LocationPanel({ countryCode, panelId, anchorRef, fallback, selectedId, title, allLabel, cityLabel, locale, onChoose, onClose }: PanelProps) {
  const t = useTranslations("locationPicker");
  const tn = useTranslations("nearby");
  const tl = useTranslations("locations");
  const pageLang = LOCALE_META[locale].htmlLang;
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isSheet] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  const [box, setBox] = useState<{ top?: number; bottom?: number; start: number; width: number; maxHeight: number } | null>(null);
  const [country, setCountry] = useState<string | undefined>(countryCode);
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [data, setData] = useState<GeoList | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState<Locating>(null);

  // Position (popover) or lock the page behind the sheet (phone).
  useLayoutEffect(() => {
    if (isSheet) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const width = Math.min(Math.max(r.width, 340), vw - 16);
      const edge = getComputedStyle(anchor).direction === "rtl" ? vw - r.right : r.left;
      const below = Math.max(0, window.innerHeight - r.bottom - 16);
      const above = Math.max(0, r.top - 16);
      // Category navigation can push the field down: keep options reachable instead of extending below the viewport.
      const opensAbove = below < 320 && above > below;
      setBox({
        ...(opensAbove ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }),
        start: Math.max(8, Math.min(edge, vw - width - 8)),
        width,
        maxHeight: Math.min(540, opensAbove ? above : below),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isSheet, anchorRef]);

  // Focus the search field; a click outside the popover closes it.
  useEffect(() => {
    searchRef.current?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!isSheet && !panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) onClose(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [isSheet, anchorRef, onClose]);

  useEffect(() => {
    const timer = setTimeout(() => setSearched(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Countries, regions and cities for the current step. A text search looks across the whole country.
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchGeoList({ country, region: searched ? undefined : region || undefined, q: searched || undefined }, controller.signal)
      .then((list) => {
        setData(list);
        setStatus("ready");
        setActive(0);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [country, region, searched]);

  const typed = query.trim();
  const pending = typed !== "" && (typed !== searched || status === "loading");
  const rows = useMemo<Row[]>(() => {
    let cityRows: Row[];
    if (data) {
      cityRows = data.cities.map((city) => ({
        id: city.id,
        text: nameOf(city, locale).text,
        localized: nameOf(city, locale),
        count: city.count,
        picked: pickedFrom(city, locale),
        names: [city.nameEn, city.nameCkb, city.nameKmr, city.nameDe, city.nameFa, city.nameAr, city.nameTr],
      }));
    } else {
      // Until the first answer arrives, the page's own bounded list keeps the panel useful.
      cityRows = fallback.map((city) => {
        const text = plainCityName(city);
        return { id: city.id, text, picked: { id: city.id, name: text, countryCode: null, regionId: null }, names: [text] };
      });
    }
    // While a search is still on its way, what is shown is narrowed by the typed text right away, so Enter never
    // picks a row from the previous list that does not match what was typed.
    const shown = pending ? rankByQuery(cityRows, typed, (r) => r.names ?? [r.text], 40) : cityRows;
    return typed ? shown : [{ id: "", text: allLabel, picked: null }, ...shown];
  }, [allLabel, data, fallback, locale, pending, typed]);

  const optionId = (index: number) => `${panelId}-o${index}`;
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));
  useEffect(() => {
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return setLocating("unsupported");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchNearestGeoCity(coarsen(pos.coords.latitude), coarsen(pos.coords.longitude))
          .then((found) => {
            if (!found) return setLocating("none");
            onChoose(pickedFrom(found.city, locale));
          })
          .catch(() => setLocating("unavailable"));
      },
      (err) => setLocating(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(activeIndex + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[activeIndex];
      if (row) onChoose(row.picked);
    }
  };

  // Escape closes; Tab stays inside the panel.
  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose(true);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), select:not([disabled]), input:not([disabled])");
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const countries = data?.countries ?? [];
  const regions = data?.regions ?? [];
  const field = "min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10";
  const message =
    locating === "busy" ? tn("locating")
    : locating === "denied" ? tn("permissionDenied")
    : locating === "unavailable" ? tn("unavailable")
    : locating === "unsupported" ? tn("unsupported")
    : locating === "none" ? t("noNearbyCity")
    : null;

  const panel = (
    <>
      {isSheet && <div className="fixed inset-0 z-[80] bg-black/40" aria-hidden="true" onClick={() => onClose(true)} />}
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal={isSheet}
        aria-label={title}
        onKeyDown={onPanelKey}
        style={!isSheet && box ? { top: box.top, bottom: box.bottom, insetInlineStart: box.start, width: box.width, maxHeight: box.maxHeight } : undefined}
        className={`fixed z-[90] flex flex-col gap-3 overflow-y-auto border border-line bg-surface p-3 shadow-xl ${
          isSheet ? "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "rounded-xl"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button type="button" onClick={() => onClose(true)} aria-label={t("close")} className="flex size-11 items-center justify-center rounded-lg text-lg text-muted hover:bg-surface-2">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            role="combobox"
            aria-label={cityLabel}
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={`${panelId}-list`}
            aria-activedescendant={rows.length ? optionId(activeIndex) : undefined}
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={80}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onSearchKey}
            placeholder={t("search")}
            className={`${field} pe-11`}
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label={t("clear")} className="absolute inset-y-0 end-1 flex w-10 items-center justify-center text-muted hover:text-ink">
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={locate}
          disabled={locating === "busy"}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-brand bg-surface px-3 text-sm font-bold text-brand transition hover:bg-brand hover:text-brand-ink disabled:opacity-60"
        >
          <span aria-hidden="true">◎</span>
          {tn("useLocation")}
        </button>
        {message && <p role="status" className="text-sm text-muted">{message}</p>}

        {!searched && (countries.length > 1 || regions.length > 0) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {countries.length > 1 && (
              <label className="grid gap-1 text-xs font-semibold text-muted">
                {tl("country")}
                <select value={country ?? data?.countryCode ?? ""} onChange={(e) => { setCountry(e.target.value); setRegion(""); }} className={`${field} font-normal text-ink`}>
                  {countries.map((c) => <option key={c.code} value={c.code}>{`${countryFlag(c.code)} ${countryName(c, locale)}`.trim()}</option>)}
                </select>
              </label>
            )}
            {regions.length > 0 && (
              <label className="grid gap-1 text-xs font-semibold text-muted">
                {t("region")}
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={`${field} font-normal text-ink`}>
                  <option value="">{t("allRegions")}</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{nameOf(r, locale).text}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        <ul id={`${panelId}-list`} role="listbox" aria-label={cityLabel} aria-busy={status === "loading"} className="-mx-1 min-h-24 overflow-y-auto px-1">
          {rows.map((row, index) => (
            <li
              key={row.id || "all"}
              id={optionId(index)}
              role="option"
              aria-selected={row.id === selectedId}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => active !== index && setActive(index)}
              onClick={() => onChoose(row.picked)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-start text-sm ${index === activeIndex ? "bg-brand/10" : ""} ${row.id === selectedId ? "font-bold text-brand" : ""}`}
            >
              <span className="min-w-0 truncate">{row.localized ? <Text value={row.localized} pageLang={pageLang} /> : row.text}</span>
              {row.count ? <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">{formatNumber(row.count, locale)}</span> : null}
            </li>
          ))}
        </ul>

        {status === "error" && <p role="status" className="text-sm text-muted">{t("loadFailed")}</p>}
        {status === "loading" && searched && <p role="status" className="text-sm text-muted">{t("searching")}</p>}
        {status === "ready" && searched && data && data.cities.length === 0 && <p role="status" className="text-sm text-muted">{t("noResults")}</p>}
        {status === "ready" && !searched && data?.hasMore && <p className="text-xs text-muted">{t("moreHint")}</p>}
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
