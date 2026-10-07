"use client";

/**
 * A small interactive map of known places (home page, business detail). The map library is only loaded once the
 * map scrolls into view; selecting a marker shows a compact card with a link and directions.
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LOCALE_META, formatNumber, type Locale } from "@/i18n/locales";
import type { MapLabels } from "./DiscoveryMap";

const DiscoveryMap = dynamic(() => import("./DiscoveryMap").then((m) => m.DiscoveryMap), { ssr: false });

export type PlacePoint = { id: string; lat: number; lng: number; name: string; sub?: string; href?: string };

export function PlacesMap({ points, className = "h-80" }: { points: PlacePoint[]; className?: string }) {
  const tm = useTranslations("map");
  const locale = useLocale() as Locale;
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setVisible(true);
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const center = useMemo(() => ({
    lat: points.reduce((a, p) => a + p.lat, 0) / points.length,
    lng: points.reduce((a, p) => a + p.lng, 0) / points.length,
  }), [points]);
  const mapPoints = useMemo(() => points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, label: p.name })), [points]);
  const labels: MapLabels = {
    map: tm("title"), searchArea: tm("searchArea"), unavailable: tm("unavailable"), unavailableHint: tm("unavailableHint"), you: tm("you"),
    cluster: (count) => tm("cluster", { count: formatNumber(count, locale) }), zoomIn: tm("zoomIn"), zoomOut: tm("zoomOut"),
    gestures: { windows: tm("gestureWindows"), mac: tm("gestureMac"), mobile: tm("gestureMobile") },
  };
  const sel = points.find((p) => p.id === selected);

  return (
    <div ref={box} className={className} data-testid="places-map-shell">
      {visible ? (
        <DiscoveryMap className="size-full" center={center} points={mapPoints} selectedId={selected} onSelect={setSelected} labels={labels} dir={LOCALE_META[locale].dir}>
          {sel && (
            <article className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-lift" data-testid="map-preview">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{sel.name}</p>
                {sel.sub && <p className="truncate text-xs text-muted" dir="auto">{sel.sub}</p>}
              </div>
              <a className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-line px-3 text-sm font-semibold hover:border-brand hover:text-brand" target="_blank" rel="noopener noreferrer"
                href={`https://www.google.com/maps/dir/?api=1&destination=${sel.lat},${sel.lng}`}>{tm("directions")}</a>
              {sel.href && <Link href={sel.href} className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-brand px-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{tm("details")}</Link>}
            </article>
          )}
        </DiscoveryMap>
      ) : (
        <div className="size-full rounded-[var(--radius-card)] border border-line bg-surface-2" aria-hidden="true" />
      )}
    </div>
  );
}
