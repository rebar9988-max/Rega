"use client";

/**
 * Nearby Discovery (client). Location comes ONLY from the visitor: the browser's permission prompt, a city they
 * pick or search for, or an area they move the map to. There is no default city. Coordinates are rounded to
 * ~110 m before they leave the device.
 *
 * Views: List (paginated) and Map (every match in range as clustered name/rating pills; on large screens the results
 * sit next to the map, on phones they slide over its bottom edge). Search, category, city, radius, open-now and sorting
 * drive both views; quick filters (radius, open now) float over the map. Map results are ordered by distance on the
 * device (haversine) from the search centre, and a selected business is flown to and previewed over the map.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import { localize } from "@/lib/content";
import { RADII_KM, coarsen, distanceKm } from "@/lib/geo";
import { forwardGeocode, reverseGeocode, type Place } from "@/lib/geocode";
import { getSavedLocation, saveLocation } from "@/lib/location-store";
import { Ltr, Text } from "@/components/ui/Bidi";
import { Rating } from "@/components/ui/Rating";
import { VerifiedBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { DEFAULT_MAP_STYLE_URL, mapStyleUrl } from "@/lib/map-config";
import type { MapLabels } from "@/components/map/DiscoveryMap";

const DiscoveryMap = dynamic(() => import("@/components/map/DiscoveryMap").then((m) => m.DiscoveryMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-[var(--radius-card)] bg-surface-2" aria-hidden="true" />,
});

type Row = Record<string, unknown>;
export type NearbyCity = Row & { id: string; nameEn: string; latitude: number | null; longitude: number | null; country?: { code: string } };
export type NearbyCategory = Row & { id: string; nameDe: string };
type Item = {
  id: string; addressLine1: string; postalCode: string | null; countryCode: string; latitude: number; longitude: number;
  phone: string | null; distanceKm: number; openNow: boolean | null;
  city: (Row & { nameEn: string }) | null;
  category: (Row & { nameDe: string }) | null;
  business: Row & { slug: string; name: string; verified: boolean; ratingAvg: number; ratingCount: number; logoUrl: string | null; coverUrl: string | null };
};
type Center = { lat: number; lng: number; label: { kind: "device" } | { kind: "city"; id: string } | { kind: "area" } };
type Status = "idle" | "locating" | "denied" | "unavailable" | "unsupported" | "loading" | "ready" | "error";
type Filters = { radius: number; q: string; category: string; open: boolean; sort: "distance" | "rating" };

const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";
const LIST_PAGE = 20;
/** Radii offered as one-tap chips over the map ("All" uses the largest radius). */
const QUICK_RADII = [5, 10, 25] as const;
const MAX_RADIUS = RADII_KM[RADII_KM.length - 1];
const CAROUSEL_MAX = 30;

/** Filters that can arrive in the URL (e.g. the home page's "Open now" link: /nearby?open=1). Location never does. */
export type NearbyInitial = { open?: boolean; category?: string; q?: string; radius?: number; sort?: Filters["sort"] };

export function NearbyDiscovery({ cities, categories, initial }: { cities: NearbyCity[]; categories: NearbyCategory[]; initial?: NearbyInitial }) {
  const t = useTranslations("nearby");
  const tm = useTranslations("map");
  const locale = useLocale() as Locale;
  const pageLang = LOCALE_META[locale].htmlLang;
  const dir = LOCALE_META[locale].dir;
  const [center, setCenter] = useState<Center | null>(null);
  const [device, setDevice] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [view, setView] = useState<"list" | "map">("list");
  // Before a location is known the page shows a still picture of the start map (public/maps); the live map replaces it
  // at the visitor's first interaction (or at once with a custom map style, which the picture would not match).
  const [liveIntroMap, setLiveIntroMap] = useState(() => mapStyleUrl() !== DEFAULT_MAP_STYLE_URL);
  useEffect(() => {
    if (liveIntroMap) return;
    const events = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "scroll"] as const;
    const start = () => {
      events.forEach((e) => window.removeEventListener(e, start));
      setLiveIntroMap(true);
    };
    events.forEach((e) => window.addEventListener(e, start, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, start));
  }, [liveIntroMap]);
  const [mapItems, setMapItems] = useState<Item[] | null>(null);
  const [mapShown, setMapShown] = useState(LIST_PAGE);
  const [selected, setSelected] = useState<string | null>(null);
  const [stack, setStack] = useState<string[] | null>(null); // businesses sharing one position
  const [filters, setFilters] = useState<Filters>(() => ({
    radius: initial?.radius && (RADII_KM as readonly number[]).includes(initial.radius) ? initial.radius : 10,
    q: initial?.q ?? "",
    category: initial?.category && categories.some((c) => c.id === initial.category) ? initial.category : "",
    open: Boolean(initial?.open),
    sort: initial?.sort === "rating" ? "rating" : "distance",
  }));
  const [q, setQ] = useState(initial?.q ?? "");
  const request = useRef(0);
  const mapRequest = useRef(0);

  const cityName = useCallback((c: NearbyCity) => localize({ ...c, name: c.nameEn }, "name", locale).text, [locale]);
  const places = useMemo<Place[]>(() => cities.filter((c) => c.latitude != null && c.longitude != null).map((c) => ({
    id: c.id, lat: c.latitude!, lng: c.longitude!, countryCode: c.country?.code ?? "",
    names: [c.nameEn, ...["nameCkb", "nameKmr", "nameDe", "nameAr", "nameTr"].map((k) => c[k]).filter((v): v is string => typeof v === "string" && v.length > 0)],
  })), [cities]);

  // Map results with their distance computed here (haversine from the search centre); nearest first unless the
  // visitor sorts by rating (then the server's order is kept).
  const mapList = useMemo(() => {
    const rows = (mapItems ?? []).map((it) => (center ? { ...it, distanceKm: distanceKm(center, { lat: it.latitude, lng: it.longitude }) } : it));
    return filters.sort === "distance" ? rows.sort((a, b) => a.distanceKm - b.distanceKm) : rows;
  }, [mapItems, center, filters.sort]);

  const mapListRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!selected || view !== "map") return;
    const index = mapList.findIndex((item) => item.id === selected);
    if (index < 0) return;
    if (index >= mapShown) {
      setMapShown(Math.ceil((index + 1) / LIST_PAGE) * LIST_PAGE);
      return;
    }
    const list = mapListRef.current;
    const row = list?.children[index] as HTMLElement | undefined;
    if (!list || !row || list.clientHeight === 0) return;
    // Scroll only this pane; selecting a marker must not move the whole page or steal keyboard focus.
    const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (offset < 0 || offset + row.offsetHeight > list.clientHeight) {
      list.scrollTo({ top: list.scrollTop + offset, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [selected, view, mapList, mapShown]);

  // Stable marker data: the map only re-fits when the results really change.
  const points = useMemo(() => mapList.map((it) => ({
    id: it.id, lat: it.latitude, lng: it.longitude, label: localize(it.business, "name", locale).text,
    badge: it.business.ratingCount > 0 ? `★ ${formatNumber(it.business.ratingAvg, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : undefined,
  })), [mapList, locale]);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return setStatus("unsupported");
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: coarsen(pos.coords.latitude), lng: coarsen(pos.coords.longitude) };
        setDevice(here);
        setCenter({ ...here, label: { kind: "device" } });
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  function pickCity(id: string) {
    const c = cities.find((x) => x.id === id);
    if (c?.latitude != null && c.longitude != null) {
      setCenter({ lat: c.latitude, lng: c.longitude, label: { kind: "city", id } });
      // The same place is then offered on the home page and the business lists (saved in this browser only).
      saveLocation({ cityId: id, countryCode: c.country?.code ?? null });
    }
  }

  // The place the visitor chose elsewhere on the site starts the map there. Nothing is assumed when none was chosen.
  useEffect(() => {
    const pref = getSavedLocation();
    const city = pref ? cities.find((c) => c.id === pref.cityId) : undefined;
    const lat = city?.latitude;
    const lng = city?.longitude;
    if (city && lat != null && lng != null) setCenter((current) => current ?? { lat, lng, label: { kind: "city", id: city.id } });
  }, [cities]);

  // Keep the filters in the address bar (never the location), so refresh, back/forward and shared links keep them.
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (k: string, v: string | null) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    set("open", filters.open ? "1" : null);
    set("category", filters.category || null);
    set("q", filters.q || null);
    set("radius", filters.radius !== 10 ? String(filters.radius) : null);
    set("sort", filters.sort !== "distance" ? filters.sort : null);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
  }, [filters]);

  // Debounce free-text filtering so typing does not fire a request per key.
  useEffect(() => {
    const h = setTimeout(() => setFilters((f) => (f.q === q.trim() ? f : { ...f, q: q.trim() })), 350);
    return () => clearTimeout(h);
  }, [q]);

  const params = useCallback((c: Center, extra: Record<string, string>) => {
    const p = new URLSearchParams({ lat: String(c.lat), lng: String(c.lng), radius: String(filters.radius), sort: filters.sort, ...extra });
    if (filters.q) p.set("q", filters.q);
    if (filters.category) p.set("category", filters.category);
    if (filters.open) p.set("open", "1");
    return p;
  }, [filters]);

  const load = useCallback(async (c: Center, p: number) => {
    const id = ++request.current;
    setStatus("loading");
    try {
      const res = await fetch(`/api/v1/nearby?${params(c, { page: String(p) })}`, { headers: { accept: "application/json" } });
      const body = await res.json();
      if (id !== request.current) return; // a newer request superseded this one
      if (!res.ok || !body.ok) throw new Error(body?.error?.code ?? String(res.status));
      setItems((prev) => (p === 1 ? body.data : [...prev, ...body.data]));
      setTotal(body.meta.total);
      setPages(body.meta.pages);
      setPage(p);
      setStatus("ready");
    } catch {
      if (id === request.current) setStatus("error");
    }
  }, [params]);

  // Map view: every match in range in one request (markers are clustered), refreshed with the filters.
  const loadMap = useCallback(async (c: Center) => {
    const id = ++mapRequest.current;
    try {
      const res = await fetch(`/api/v1/nearby?${params(c, { mode: "map" })}`, { headers: { accept: "application/json" } });
      const body = await res.json();
      if (id !== mapRequest.current) return;
      if (!res.ok || !body.ok) throw new Error(String(res.status));
      setMapItems(body.data);
      setMapShown(LIST_PAGE);
    } catch {
      if (id === mapRequest.current) setMapItems(null);
    }
  }, [params]);

  useEffect(() => { if (center) { setSelected(null); setStack(null); void load(center, 1); } }, [center, load]);
  useEffect(() => { if (center && view === "map") void loadMap(center); else setMapItems(null); }, [center, view, loadMap]);

  const placeName = (() => {
    if (!center) return "";
    if (center.label.kind === "area") return t("inArea");
    if (center.label.kind === "device") {
      const near = reverseGeocode(center, places);
      const nearCity = near && cities.find((c) => c.id === near.id);
      return `${t("near", { place: t("yourLocation") })}${nearCity ? ` · ${cityName(nearCity)}` : ""}`;
    }
    const id = center.label.id;
    const c = cities.find((x) => x.id === id);
    return c ? t("near", { place: cityName(c) }) : "";
  })();

  // Place search: the text box also finds known cities by name in any language (geocoding over our own data).
  const placeMatches = center && q.trim().length >= 2 ? forwardGeocode(q, places, 3).filter((p) => !(center.label.kind === "city" && center.label.id === p.id)) : [];

  const citySelect = (testId?: string) => (
    <select className={field} value={center?.label.kind === "city" ? center.label.id : ""} onChange={(e) => pickCity(e.target.value)} data-testid={testId} aria-label={t("chooseCity")}>
      <option value="" disabled>{t("chooseCity")}</option>
      {cities.map((c) => <option key={c.id} value={c.id}>{cityName(c)}</option>)}
    </select>
  );

  const labels: MapLabels = {
    map: tm("title"), searchArea: tm("searchArea"), unavailable: tm("unavailable"), unavailableHint: tm("unavailableHint"), you: tm("you"),
    cluster: (count) => tm("cluster", { count: formatNumber(count, locale) }), zoomIn: tm("zoomIn"), zoomOut: tm("zoomOut"),
    gestures: { windows: tm("gestureWindows"), mac: tm("gestureMac"), mobile: tm("gestureMobile") },
  };

  const distance = (it: Item) => t("away", {
    distance: it.distanceKm < 0.1
      ? `< ${t("km", { km: formatNumber(0.1, locale) })}`
      : t("km", { km: formatNumber(it.distanceKm, locale, { maximumFractionDigits: it.distanceKm < 10 ? 1 : 0 }) }),
  });

  // ---------- before a location is known: map-first discovery, without assuming the visitor's city
  if (!center) {
    const notice = { denied: t("permissionDenied"), unavailable: t("unavailable"), unsupported: t("unsupported") }[status as "denied" | "unavailable" | "unsupported"];
    const germany = { lat: 51.1657, lng: 10.4515 };
    return (
      <section className="container-page pb-10" aria-live="polite">
        <div className="rega-shell overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(19rem,0.9fr)_minmax(0,1.6fr)]">
            <div className="order-2 p-5 sm:p-7 lg:order-1 lg:p-8">
              <div className="mb-5 inline-flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-text"><LocateIcon /></div>
              <h2 className="text-xl font-bold tracking-tight">{t("title")}</h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted">{t("start")}</p>
              {notice && <p role="alert" data-testid="nearby-notice" className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink">{notice}</p>}
              <div className="mt-6 grid gap-3">
                {status !== "unsupported" && (
                  <button type="button" onClick={locate} disabled={status === "locating"} data-testid="nearby-locate"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink shadow-sm transition hover:bg-brand-hover disabled:opacity-60">
                    <LocateIcon />
                    {status === "locating" ? t("locating") : t("useLocation")}
                  </button>
                )}
                {cities.length > 0 && (
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold">{t("chooseCity")}</span>
                    {citySelect("nearby-city")}
                  </label>
                )}
              </div>
              <p className="mt-5 text-xs leading-5 text-muted">{t("privacy")}</p>
            </div>
            <div className="order-1 h-[42dvh] min-h-[20rem] border-b border-line lg:order-2 lg:h-[34rem] lg:border-b-0 lg:border-s">
              {!liveIntroMap ? (
                // Same view as the live map below (style, centre, zoom and radius), as a still picture: MapLibre is
                // only loaded once the visitor interacts with the page, so a first visit does not pay for it.
                <div className="relative isolate size-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-2 shadow-card" data-testid="discovery-map" data-status="preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/maps/nearby-intro-de@1x.webp" srcSet="/maps/nearby-intro-de@1x.webp 1x, /maps/nearby-intro-de@2x.webp 2x" alt="" width={800} height={560}
                    decoding="async" fetchPriority="low" className="absolute left-1/2 top-1/2 h-[560px] w-[800px] max-w-none -translate-x-1/2 -translate-y-1/2" />
                </div>
              ) : <DiscoveryMap
                className="size-full"
                center={germany}
                radiusKm={250}
                points={[]}
                selectedId={null}
                onSelect={() => undefined}
                onSearchArea={(c) => setCenter({ ...c, label: { kind: "area" } })}
                user={null}
                labels={labels}
                dir={dir}
              />}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const selectedItem = (mapItems ? mapList : items).find((it) => it.id === selected) ?? null;

  const chip = (active: boolean, label: string, onClick: () => void, testId: string) => (
    <button key={testId} type="button" aria-pressed={active} onClick={onClick} data-testid={testId}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold shadow-lift ring-1 transition-colors ${active ? "bg-brand text-brand-ink ring-brand" : "bg-surface text-ink ring-line hover:text-brand-text"}`}>
      {label}
    </button>
  );
  const quickFilters = (
    <div className="flex gap-2 overflow-x-auto p-0.5 [scrollbar-width:none]" role="group" aria-label={t("quickFilters")} data-testid="nearby-quick-filters">
      {chip(!filters.open && !(QUICK_RADII as readonly number[]).includes(filters.radius), t("all"), () => setFilters((f) => ({ ...f, open: false, radius: MAX_RADIUS })), "nearby-chip-all")}
      {QUICK_RADII.map((r) => chip(filters.radius === r, t("km", { km: formatNumber(r, locale) }), () => setFilters((f) => ({ ...f, radius: r })), `nearby-chip-${r}`))}
      {chip(filters.open, t("open"), () => setFilters((f) => ({ ...f, open: !f.open })), "nearby-chip-open")}
    </div>
  );

  return (
    <section className="container-page pb-28 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold" data-testid="nearby-place">{placeName}</p>
        <div className="flex flex-wrap items-center gap-3">
          {center.label.kind !== "device" && status !== "unsupported" && (
            <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline" onClick={locate}>
              <LocateIcon className="size-4" />{t("useLocation")}
            </button>
          )}
          <button type="button" className="text-sm font-semibold text-muted hover:text-ink hover:underline" onClick={() => { setCenter(null); setStatus("idle"); setItems([]); setMapItems(null); }}>
            {t("changeLocation")}
          </button>
        </div>
      </div>

      <form className="rega-search-shell grid grid-cols-2 gap-2 p-3 md:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" onSubmit={(e) => e.preventDefault()} role="search">
        <div className="col-span-2 md:col-span-3 lg:col-span-1">
          <label className="sr-only" htmlFor="nearby-q">{t("searchPlaceholder")}</label>
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
            <input id="nearby-q" className={`${field} ps-9`} type="search" value={q} maxLength={100} placeholder={t("searchPlaceholder")} onChange={(e) => setQ(e.target.value)} data-testid="nearby-q" />
          </div>
          {placeMatches.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" data-testid="nearby-place-matches">
              {placeMatches.map((p) => {
                const c = cities.find((x) => x.id === p.id)!;
                return (
                  <button key={p.id} type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-bg px-3 text-xs font-semibold hover:border-brand hover:text-brand-text"
                    onClick={() => { pickCity(p.id); setQ(""); }}>
                    <PinIcon className="size-3.5 text-brand-text" />{t("searchIn", { place: cityName(c) })}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {cities.length > 0 && citySelect("nearby-city-filter")}
        <select className={field} value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} aria-label={t("category")}>
          <option value="">{t("allCategories")}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{localize({ ...c, name: c.nameDe }, "name", locale).text}</option>)}
        </select>
        <select className={field} value={filters.radius} onChange={(e) => setFilters((f) => ({ ...f, radius: Number(e.target.value) }))} aria-label={t("radius")} data-testid="nearby-radius">
          {RADII_KM.map((r) => <option key={r} value={r}>{t("km", { km: formatNumber(r, locale) })}</option>)}
        </select>
        <select className={field} value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as Filters["sort"] }))} aria-label={t("sort")}>
          <option value="distance">{t("sortDistance")}</option>
          <option value="rating">{t("sortRating")}</option>
        </select>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-5 accent-brand-control" checked={filters.open} onChange={(e) => setFilters((f) => ({ ...f, open: e.target.checked }))} data-testid="nearby-open" />
          {t("openNow")}
        </label>
      </form>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite" data-testid="nearby-count">{status === "ready" ? t("results", { count: formatNumber(total, locale) }) : status === "loading" ? "…" : ""}</p>
        {/* Phones, list view: a floating pill above the bottom navigation. Map view (where the cards fill the bottom of
            the map) and large screens: inline next to the count. */}
        <div className={view === "list"
          ? "pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center md:bottom-6 lg:pointer-events-auto lg:static lg:z-auto lg:block"
          : ""}>
          <div className={`pointer-events-auto inline-flex rounded-full bg-surface p-1 ring-1 ring-line lg:rounded-xl lg:shadow-none ${view === "list" ? "shadow-lift" : ""}`} role="group" data-testid="nearby-view-toggle">
            {(["list", "map"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} data-testid={`nearby-view-${v}`}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors lg:min-h-9 lg:rounded-lg ${view === v ? "bg-brand text-brand-ink" : "text-muted hover:text-ink"}`}>
                {v === "list" ? <ListIcon /> : <MapIcon />}{t(v)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {status === "error" && (
        <div role="alert" className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center">
          <p className="font-semibold">{t("error")}</p>
          <button type="button" className="mt-3 min-h-11 rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink" onClick={() => load(center, 1)}>{t("retry")}</button>
        </div>
      )}

      {status === "ready" && total === 0 && (
        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center" data-testid="nearby-empty">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-brand-text"><PinIcon className="size-6" /></span>
          <p className="mt-3 font-semibold">{t("empty")}</p>
          <p className="mt-2 text-sm text-muted">{t("emptyHint")}</p>
        </div>
      )}

      {/* ---------- map view: results beside the map on large screens, map first on phones */}
      {view === "map" && (
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Large screens: nearest first beside the map (on the reading side: right in RTL). */}
          <ul ref={mapListRef} className="order-2 hidden max-h-[calc(100dvh-8rem)] min-h-[34rem] space-y-3 overflow-y-auto pe-1 lg:order-1 lg:block" data-testid="nearby-map-list" aria-label={t("list")}>
            {mapList.slice(0, mapShown).map((it) => {
              const image = it.business.coverUrl ?? it.business.logoUrl;
              const name = localize(it.business, "name", locale);
              return (
                <li key={it.id}>
                  <button type="button" onClick={() => setSelected(it.id)} aria-pressed={selected === it.id}
                    className={`flex w-full items-center gap-3 rounded-[var(--radius-card)] border bg-surface p-3 text-start transition-[border-color,box-shadow] hover:shadow-card ${selected === it.id ? "border-brand shadow-card ring-2 ring-brand/20" : "border-line hover:border-brand/40"}`}>
                    {image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={image} alt="" width={72} height={72} loading="lazy" decoding="async" className="size-[4.5rem] shrink-0 rounded-xl bg-surface-2 object-cover" />
                      : <Avatar name={name.text} src={null} size="size-[4.5rem]" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold"><Text value={name} pageLang={pageLang} /></span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {it.category ? <Text value={localize({ ...it.category, name: it.category.nameDe }, "name", locale)} pageLang={pageLang} /> : <Ltr>{it.addressLine1}</Ltr>}
                        {it.city && <> · <Text value={localize({ ...it.city, name: it.city.nameEn }, "name", locale)} pageLang={pageLang} /></>}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        {it.business.ratingCount > 0 && <Rating value={it.business.ratingAvg} count={it.business.ratingCount} />}
                        {openBadge(it.openNow)}
                      </span>
                    </span>
                    <span className="shrink-0 self-start rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-text">{distance(it)}</span>
                  </button>
                </li>
              );
            })}
            {mapList.length > mapShown && (
              <li><button type="button" className="min-h-11 w-full rounded-xl border border-line bg-surface text-sm font-semibold hover:border-brand hover:text-brand-text" onClick={() => setMapShown((n) => n + LIST_PAGE)}>{t("loadMore")}</button></li>
            )}
          </ul>
          <div className="relative order-1 h-[min(72dvh,640px)] min-h-[24rem] lg:order-2 lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)] lg:min-h-[34rem]">
            <DiscoveryMap
              className="size-full"
              center={center}
              radiusKm={filters.radius}
              points={points}
              selectedId={selected}
              onSelect={(id) => { setSelected(id); setStack(null); }}
              onSelectMany={(ids) => { setSelected(null); setStack(ids); }}
              onSearchArea={(c) => setCenter({ ...c, label: { kind: "area" } })}
              user={device}
              labels={labels}
              dir={dir}
              markerStyle="pill"
              focusSelected
              fitPadding={{ top: 104, bottom: 160, x: 100 }}
              toolbar={quickFilters}
              locate={status !== "unsupported" ? { label: t("locateMe"), busy: status === "locating", onClick: () => { setFilters((f) => (f.sort === "distance" ? f : { ...f, sort: "distance" })); locate(); } } : undefined}
            >
              {selectedItem ? preview(selectedItem) : stack && stackList(stack)}
            </DiscoveryMap>
            {/* Phones: nearest results as swipeable cards over the bottom of the map; a tap flies to the business. */}
            {!selectedItem && !stack && mapList.length > 0 && (
              <ul className="absolute inset-x-0 bottom-8 z-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] lg:hidden" data-testid="nearby-carousel" aria-label={t("list")}>
                {mapList.slice(0, CAROUSEL_MAX).map((it) => {
                  const image = it.business.coverUrl ?? it.business.logoUrl;
                  const name = localize(it.business, "name", locale);
                  return (
                    <li key={it.id} className="w-[80%] max-w-xs shrink-0 snap-center">
                      <button type="button" onClick={() => setSelected(it.id)} className="rega-shell flex w-full items-center gap-3 p-2.5 text-start shadow-lift">
                        {image
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={image} alt="" width={56} height={56} loading="lazy" decoding="async" className="size-14 shrink-0 rounded-xl bg-surface-2 object-cover" />
                          : <Avatar name={name.text} src={null} size="size-14" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold"><Text value={name} pageLang={pageLang} /></span>
                          <span className="mt-0.5 block truncate text-xs text-muted">
                            {it.category && <Text value={localize({ ...it.category, name: it.category.nameDe }, "name", locale)} pageLang={pageLang} />}
                          </span>
                          <span className="mt-1 flex items-center gap-2 text-xs">
                            <span className="font-bold text-brand-text">{distance(it)}</span>
                            {it.business.ratingCount > 0 && <Rating value={it.business.ratingAvg} count={it.business.ratingCount} />}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ---------- list view */}
      {view === "list" && status === "loading" && items.length === 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => <li key={i} className="h-40 animate-pulse rounded-[var(--radius-card)] bg-surface-2" />)}
        </ul>
      )}

      {view === "list" && items.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="nearby-results">
          {items.map((it) => {
            const name = localize(it.business, "name", locale);
            const city = it.city ? localize({ ...it.city, name: it.city.nameEn }, "name", locale) : null;
            return (
              <li key={it.id} className="rega-card relative flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-base font-bold">
                    <Link href={`/business/${it.business.slug}`} className="hover:underline"><Text value={name} pageLang={pageLang} /></Link>
                  </h3>
                  <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-text" data-testid="nearby-distance">{distance(it)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Rating value={it.business.ratingAvg} count={it.business.ratingCount} />
                  {it.business.verified && <VerifiedBadge />}
                  {openBadge(it.openNow)}
                </div>
                <address className="text-sm not-italic text-muted">
                  <Ltr>{it.addressLine1}</Ltr>{it.postalCode && <>, <Ltr>{it.postalCode}</Ltr></>}{city && <> · <Text value={city} pageLang={pageLang} /></>}
                </address>
                <div className="mt-auto flex flex-wrap gap-2 pt-1 text-sm font-semibold">
                  <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 hover:border-brand hover:text-brand-text" onClick={() => { setView("map"); setSelected(it.id); }}>
                    <MapIcon />{t("showOnMap")}
                  </button>
                  {it.phone && <a className="inline-flex min-h-10 items-center rounded-xl border border-line px-3 hover:border-brand hover:text-brand-text" href={`tel:${it.phone.replace(/[^\d+]/g, "")}`}>{t("call")}</a>}
                  <Link className="inline-flex min-h-10 items-center rounded-xl bg-brand px-3 text-brand-ink hover:bg-brand-hover" href={`/business/${it.business.slug}`}>{t("details")}</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {view === "list" && status === "ready" && page < pages && (
        <div className="mt-6 text-center">
          <button type="button" className="min-h-11 rounded-xl border border-line bg-surface px-6 text-sm font-semibold hover:border-brand hover:text-brand-text" onClick={() => load(center, page + 1)}>{t("loadMore")}</button>
        </div>
      )}
      <p className="mt-6 text-xs text-muted">{t("privacy")}</p>
    </section>
  );

  function openBadge(value: boolean | null) {
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${value === true ? "bg-[oklch(0.95_0.05_150)] text-[oklch(0.4_0.12_150)]" : "bg-surface-2 text-muted"}`}>
        {value === true ? t("open") : value === false ? t("closed") : t("hoursUnknown")}
      </span>
    );
  }

  function stackList(ids: string[]) {
    const rows = mapList.filter((it) => ids.includes(it.id));
    return (
      <article className="rega-shell max-h-72 overflow-y-auto p-3" data-testid="map-stack">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <p className="text-sm font-bold">{t("results", { count: formatNumber(rows.length, locale) })}</p>
          <button type="button" onClick={() => setStack(null)} aria-label={tm("close")} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <ul className="space-y-1">
          {rows.map((it) => (
            <li key={it.id}>
              <button type="button" onClick={() => { setSelected(it.id); setStack(null); }} className="flex w-full items-center gap-3 rounded-xl p-2 text-start hover:bg-surface-2">
                <Avatar name={localize(it.business, "name", locale).text} src={it.business.logoUrl} size="size-9" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold"><Text value={localize(it.business, "name", locale)} pageLang={pageLang} /></span>
              </button>
            </li>
          ))}
        </ul>
      </article>
    );
  }

  function preview(it: Item) {
    const dist = distance(it);
    const onClose = () => setSelected(null);
    const name = localize(it.business, "name", locale);
    const city = it.city ? localize({ ...it.city, name: it.city.nameEn }, "name", locale) : null;
    const image = it.business.coverUrl ?? it.business.logoUrl;
    const close = (extra: string) => (
      <button type="button" onClick={onClose} aria-label={tm("close")} className={`grid size-8 shrink-0 place-items-center rounded-full ${extra}`}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    );
    return (
      <article className="rega-shell overflow-hidden shadow-lift" data-testid="map-preview" aria-label={name.text} dir={dir}>
        {image && (
          <div className="relative h-28 bg-surface-2 sm:h-32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" width={448} height={128} loading="lazy" decoding="async" className="size-full object-cover" />
            <span className="absolute start-3 top-3">{openBadge(it.openNow)}</span>
            {close("absolute end-2 top-2 bg-surface text-ink shadow-card hover:text-brand-text")}
          </div>
        )}
        <div className="p-4">
          <div className="flex gap-3">
            {!image && <Avatar name={name.text} src={null} size="size-12" />}
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-bold"><Text value={name} pageLang={pageLang} /></h3>
              <p className="mt-0.5 truncate text-xs text-muted">
                {it.category && <span className="font-semibold text-brand-text"><Text value={localize({ ...it.category, name: it.category.nameDe }, "name", locale)} pageLang={pageLang} /></span>}
                {it.category && city && " · "}
                {city && <Text value={city} pageLang={pageLang} />}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                {it.business.ratingCount > 0 && <Rating value={it.business.ratingAvg} count={it.business.ratingCount} />}
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 font-bold text-brand-text">{dist}</span>
                {!image && openBadge(it.openNow)}
                {it.business.verified && <VerifiedBadge />}
              </div>
            </div>
            {!image && close("-me-1 -mt-1 text-muted hover:bg-surface-2 hover:text-ink")}
          </div>
          <div className="mt-3 flex gap-2 text-sm font-semibold">
            <Link className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand px-3 text-brand-ink hover:bg-brand-hover" href={`/business/${it.business.slug}`}>{t("viewProfile")}</Link>
            <a className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 hover:border-brand hover:text-brand-text" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${it.latitude},${it.longitude}`}>
              <DirectionsIcon />{t("getDirections")}
            </a>
            {it.phone && (
              <a className="grid min-h-11 w-11 shrink-0 place-items-center rounded-xl border border-line hover:border-brand hover:text-brand-text" href={`tel:${it.phone.replace(/[^\d+]/g, "")}`} aria-label={t("call")} title={it.phone}>
                <PhoneIcon />
              </a>
            )}
          </div>
        </div>
      </article>
    );
  }
}

function LocateIcon({ className = "size-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>;
}
function PinIcon({ className = "size-4" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
function ListIcon() {
  return <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>;
}
function MapIcon() {
  return <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" /></svg>;
}
function DirectionsIcon() {
  return <svg viewBox="0 0 24 24" className="size-4 shrink-0 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8-8-2Z" /></svg>;
}
function PhoneIcon() {
  return <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>;
}
