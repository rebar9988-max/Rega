"use client";

/**
 * Interactive discovery map (MapLibre GL, vector basemap from src/lib/map-config.ts).
 * - Loaded on demand (the library is only fetched when a map is shown).
 * - Businesses are clustered; markers are real <button>s, so they are keyboard and screen-reader accessible.
 * - Shows the search radius and the visitor's own position when they shared it; offers "search this area" after
 *   the visitor moves the map. Pages keep working without it: on any load failure a clean fallback is shown.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GeoJSONSource, Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import { MAPLIBRE_WORKER_URL, mapStyleUrl } from "@/lib/map-config";
import { circleRing, zoomForRadius } from "@/lib/geocode";
import { coarsen, distanceKm } from "@/lib/geo";

export type MapPoint = { id: string; lat: number; lng: number; label: string };
export type MapLabels = {
  map: string; searchArea: string; unavailable: string; unavailableHint: string; you: string;
  cluster: (count: number) => string; zoomIn: string; zoomOut: string;
  gestures: { windows: string; mac: string; mobile: string };
};
type LatLng = { lat: number; lng: number };

/** REGA red (logo); MapLibre paints need a plain colour, not the oklch design token. */
const BRAND = "#dc0201";
/** Beyond this zoom markers are never clustered, except ones at (nearly) identical coordinates. */
const CLUSTER_MAX_ZOOM = 16;
const STORE_ICON = '<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/></svg>';

export function DiscoveryMap({
  center, radiusKm, points, selectedId, onSelect, onSelectMany, onSearchArea, user, labels, dir, className = "", children,
}: {
  center: LatLng; radiusKm?: number; points: MapPoint[]; selectedId: string | null;
  onSelect: (id: string | null) => void; onSelectMany?: (ids: string[]) => void; onSearchArea?: (c: LatLng) => void; user?: LatLng | null;
  labels: MapLabels; dir: "rtl" | "ltr"; className?: string; children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef(new Map<string, MlMarker>());
  const userMarker = useRef<MlMarker | null>(null);
  const latest = useRef({ onSelect, onSelectMany, onSearchArea, center, radiusKm, labels, selectedId });
  latest.current = { onSelect, onSelectMany, onSearchArea, center, radiusKm, labels, selectedId };
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [moved, setMoved] = useState(false);

  // ---- create the map once
  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    let failTimer: ReturnType<typeof setTimeout> | undefined;
    const markerStore = markers.current;
    (async () => {
      try {
        const lib = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        libRef.current = lib;
        lib.setWorkerUrl(MAPLIBRE_WORKER_URL);
        const { labels: l, center: c, radiusKm: r } = latest.current;
        const map = new lib.Map({
          container: box.current,
          style: mapStyleUrl(),
          center: [c.lng, c.lat],
          zoom: zoomForRadius(r ?? 5),
          maxZoom: 19,
          attributionControl: false,
          cooperativeGestures: true, // page scrolling is never hijacked; ctrl/two fingers to zoom or pan
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": l.gestures.windows,
            "CooperativeGesturesHandler.MacHelpText": l.gestures.mac,
            "CooperativeGesturesHandler.MobileHelpText": l.gestures.mobile,
            "NavigationControl.ZoomIn": l.zoomIn,
            "NavigationControl.ZoomOut": l.zoomOut,
            "Map.Title": l.map,
          },
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.addControl(new lib.NavigationControl({ showCompass: false }), dir === "rtl" ? "top-left" : "top-right");
        map.addControl(new lib.AttributionControl({ compact: true }), dir === "rtl" ? "bottom-left" : "bottom-right");

        const fail = () => { if (!loaded && !cancelled) setStatus("failed"); };
        failTimer = setTimeout(fail, 15_000);
        map.on("error", () => { if (!map.isStyleLoaded()) fail(); });
        map.on("load", () => {
          loaded = true;
          clearTimeout(failTimer);
          map.addSource("rega-radius", { type: "geojson", data: emptyFc() });
          map.addLayer({ id: "rega-radius-fill", type: "fill", source: "rega-radius", paint: { "fill-color": BRAND, "fill-opacity": 0.04 } });
          map.addLayer({ id: "rega-radius-line", type: "line", source: "rega-radius", paint: { "line-color": BRAND, "line-opacity": 0.45, "line-width": 1.5, "line-dasharray": [2, 2] } });
          map.addSource("rega-points", { type: "geojson", data: emptyFc(), cluster: true, clusterRadius: 48, clusterMaxZoom: CLUSTER_MAX_ZOOM });
          // Invisible layer: keeps the clustered source's tiles loaded; the visible markers are HTML buttons.
          map.addLayer({ id: "rega-points-hit", type: "circle", source: "rega-points", paint: { "circle-radius": 1, "circle-opacity": 0 } });
          setStatus("ready");
        });
        map.on("render", () => { if (map.getSource("rega-points") && map.isSourceLoaded("rega-points")) syncMarkers(); });
        map.on("moveend", (e) => {
          if (!("originalEvent" in e) || !e.originalEvent) return; // only moves made by the visitor
          const { center: cc, radiusKm: rr } = latest.current;
          const now = map.getCenter();
          const bounds = map.getBounds();
          const viewKm = distanceKm({ lat: now.lat, lng: bounds.getWest() }, { lat: now.lat, lng: bounds.getEast() });
          // Offer a new search once the visitor has moved a noticeable part of the view (or of the radius).
          setMoved(distanceKm(cc, { lat: now.lat, lng: now.lng }) > Math.max(0.2, Math.min((rr ?? 5) * 0.25, viewKm * 0.2)));
        });
        // A click on the map itself (not on a marker, whose events also reach the map) clears the selection.
        map.on("click", (e) => {
          if ((e.originalEvent.target as HTMLElement | null)?.closest?.(".maplibregl-marker")) return;
          latest.current.onSelect(null);
        });
      } catch {
        if (!cancelled) setStatus("failed"); // no WebGL, blocked worker, ...
      }
    })();

    function syncMarkers() {
      const map = mapRef.current;
      const lib = libRef.current;
      if (!map || !lib) return;
      const seen = new Set<string>();
      for (const f of map.querySourceFeatures("rega-points")) {
        const p = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string; label?: string };
        const key = p.cluster ? `c${p.cluster_id}` : `p${p.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
        let m = markerStore.get(key);
        if (!m) {
          const el = document.createElement("button");
          el.type = "button";
          if (p.cluster) {
            const n = p.point_count ?? 0;
            // MapLibre positions the button with a transform: animate only the inner disc, never the button.
            el.className = "group grid place-items-center rounded-full";
            const disc = document.createElement("span");
            disc.className = `grid ${n < 10 ? "size-10" : n < 100 ? "size-12" : "size-14"} place-items-center rounded-full border-4 border-white/85 bg-brand text-sm font-bold text-white shadow-lift transition-transform duration-150 group-hover:scale-110 group-focus-visible:scale-110`;
            disc.textContent = String(n);
            el.append(disc);
            el.setAttribute("aria-label", latest.current.labels.cluster(n));
            el.addEventListener("click", async (ev) => {
              ev.stopPropagation();
              const source = map.getSource("rega-points") as GeoJSONSource;
              const zoom = await source.getClusterExpansionZoom(p.cluster_id!);
              if (zoom <= CLUSTER_MAX_ZOOM) return void map.easeTo({ center: [lng, lat], zoom });
              // Same building / same coordinates: zooming cannot separate them, so offer the list instead.
              const leaves = await source.getClusterLeaves(p.cluster_id!, 50, 0);
              const ids = leaves.map((f) => String((f.properties as { id?: string }).id)).filter(Boolean);
              const { onSelectMany, onSelect } = latest.current;
              if (onSelectMany) onSelectMany(ids); else onSelect(ids[0] ?? null);
            });
          } else {
            el.className = "rega-pin group grid size-9 place-items-center rounded-full";
            el.innerHTML = `<span class="rega-pin-disc grid size-9 place-items-center rounded-full border-2 border-white bg-brand text-white shadow-lift transition-transform duration-150 group-hover:scale-110 group-focus-visible:scale-110">${STORE_ICON}</span>`;
            el.dataset.id = p.id;
            el.setAttribute("aria-label", p.label ?? "");
            el.addEventListener("click", (ev) => { ev.stopPropagation(); latest.current.onSelect(p.id ?? null); });
          }
          m = new lib.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
          markerStore.set(key, m);
        }
        paintSelected(m.getElement(), latest.current.selectedId);
      }
      for (const [key, m] of markerStore) if (!seen.has(key)) { m.remove(); markerStore.delete(key); }
    }

    return () => {
      cancelled = true;
      clearTimeout(failTimer);
      for (const m of markerStore.values()) m.remove();
      markerStore.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [dir]);

  // ---- data: points, fitted to the results (or to the search radius when there are none)
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (status !== "ready" || !map || !lib) return;
    // Cluster ids are only meaningful for one data set: rebuild the HTML markers from scratch.
    for (const m of markers.current.values()) m.remove();
    markers.current.clear();
    (map.getSource("rega-points") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: points.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lng, p.lat] }, properties: { id: p.id, label: p.label } })),
    });
    if (points.length > 0) {
      const b = new lib.LngLatBounds([center.lng, center.lat], [center.lng, center.lat]);
      for (const p of points) b.extend([p.lng, p.lat]);
      map.fitBounds(b, { padding: 64, maxZoom: 15, duration: 400 });
    } else {
      map.easeTo({ center: [center.lng, center.lat], zoom: zoomForRadius(radiusKm ?? 5), duration: 400 });
    }
    setMoved(false);
  }, [status, points, center, radiusKm]);

  // ---- search radius overlay
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    (map.getSource("rega-radius") as GeoJSONSource).setData(
      radiusKm ? { type: "Feature", geometry: { type: "Polygon", coordinates: [circleRing(center, radiusKm)] }, properties: {} } : emptyFc(),
    );
  }, [status, center, radiusKm]);

  // ---- visitor's own position (only when they shared it)
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    userMarker.current?.remove();
    userMarker.current = null;
    if (status !== "ready" || !map || !lib || !user) return;
    const el = document.createElement("div");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", labels.you);
    el.className = "relative size-5";
    el.innerHTML = '<span class="absolute inset-0 animate-ping rounded-full bg-brand/40"></span><span class="absolute inset-0 rounded-full border-[3px] border-white bg-ink shadow-lift"></span>';
    userMarker.current = new lib.Marker({ element: el }).setLngLat([user.lng, user.lat]).addTo(map);
  }, [status, user, labels.you]);

  // ---- Escape closes the open preview, wherever focus is
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") latest.current.onSelect(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  // ---- selection: highlight, and bring an off-screen selection into view
  useEffect(() => {
    const map = mapRef.current;
    for (const m of markers.current.values()) paintSelected(m.getElement(), selectedId);
    if (!map || !selectedId) return;
    const p = points.find((x) => x.id === selectedId);
    if (p && !map.getBounds().contains([p.lng, p.lat])) map.easeTo({ center: [p.lng, p.lat], duration: 400 });
  }, [selectedId, points]);

  return (
    <div
      className={`relative isolate overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-2 shadow-card ${className}`}
      data-testid="discovery-map"
      data-status={status}
    >
      {/* MapLibre makes its container position:relative, so size it from an absolutely positioned parent. */}
      <div className="absolute inset-0"><div ref={box} className="size-full" role="region" aria-label={labels.map} /></div>
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden="true" />}
      {status === "failed" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-surface-2 p-6 text-center" role="status" data-testid="map-fallback">
          <div className="max-w-xs">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" /></svg>
            </span>
            <p className="mt-3 font-semibold">{labels.unavailable}</p>
            <p className="mt-1 text-sm text-muted">{labels.unavailableHint}</p>
          </div>
        </div>
      )}
      {status === "ready" && moved && onSearchArea && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
          <button type="button" data-testid="map-search-area"
            className="pointer-events-auto inline-flex min-h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-bold text-ink shadow-lift ring-1 ring-line hover:text-brand"
            onClick={() => {
              const c = mapRef.current?.getCenter();
              if (c) onSearchArea({ lat: coarsen(c.lat), lng: coarsen(c.lng) });
              setMoved(false);
            }}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
            {labels.searchArea}
          </button>
        </div>
      )}
      {children && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex justify-center">
          <div className="pointer-events-auto w-full max-w-md">{children}</div>
        </div>
      )}
    </div>
  );
}

function emptyFc(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function paintSelected(el: HTMLElement, selectedId: string | null) {
  if (!el.dataset.id) return;
  const on = el.dataset.id === selectedId;
  el.setAttribute("aria-pressed", String(on));
  const disc = el.querySelector(".rega-pin-disc");
  disc?.classList.toggle("scale-125", on);
  disc?.classList.toggle("ring-4", on);
  disc?.classList.toggle("ring-brand/30", on);
  el.style.zIndex = on ? "2" : "";
}
