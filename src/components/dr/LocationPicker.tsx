"use client";

/**
 * Admin location picker: a MapLibre map with one draggable marker. Clicking the map or dragging the marker sets
 * the position; external changes (address lookup, typed coordinates) move the marker. The coordinate inputs in the
 * form remain the keyboard-accessible way to set the same value, and the fallback when the map cannot load.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import { MAPLIBRE_WORKER_URL, mapStyleUrl } from "@/lib/map-config";
import { isValidCoordinate } from "@/lib/coordinates";

type LatLng = { lat: number; lng: number };
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
const PIN = '<svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true"><path d="M16 41s14-12.3 14-24A14 14 0 1 0 2 17c0 11.7 14 24 14 24Z" fill="var(--brand)" stroke="#fff" stroke-width="2.5"/><circle cx="16" cy="16" r="5.5" fill="#fff"/></svg>';

export function LocationPicker({ value, focus = null, fallbackCenter, onPick, label, unavailable, dir }: {
  /** `focus` is an area to show (a postal code's centre): the map flies there, the marker stays where it is. */
  value: LatLng | null; focus?: LatLng | null; fallbackCenter: LatLng | null; onPick: (v: LatLng) => void;
  label: string; unavailable: string; dir: "rtl" | "ltr";
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<MlMarker | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const valueRef = useRef(value);
  valueRef.current = value;
  const initial = useRef({ value, focus, fallbackCenter });
  const flown = useRef(focus ? `${focus.lat},${focus.lng}` : "");
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    const timer = setTimeout(() => { if (!loaded && !cancelled) setStatus("failed"); }, 15_000);
    (async () => {
      try {
        const lib = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        libRef.current = lib;
        lib.setWorkerUrl(MAPLIBRE_WORKER_URL);
        const { value: v, focus: f, fallbackCenter: c } = initial.current;
        const start = v ?? f ?? c;
        const map = new lib.Map({
          container: box.current, style: mapStyleUrl(), attributionControl: false,
          center: start ? [start.lng, start.lat] : [15, 35], zoom: v ? 16 : f ? 13 : c ? 12 : 2,
          dragRotate: false, pitchWithRotate: false, touchPitch: false,
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.addControl(new lib.NavigationControl({ showCompass: false }), dir === "rtl" ? "top-left" : "top-right");
        map.addControl(new lib.AttributionControl({ compact: true }), dir === "rtl" ? "bottom-left" : "bottom-right");
        map.on("error", () => { if (!map.isStyleLoaded() && !loaded) setStatus("failed"); });
        map.on("load", () => { loaded = true; clearTimeout(timer); setStatus("ready"); });
        map.on("click", (e) => onPickRef.current({ lat: round6(e.lngLat.lat), lng: round6(e.lngLat.lng) }));
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => { cancelled = true; clearTimeout(timer); mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; };
  }, [dir]);

  // Marker follows the value (from a click, a drag, the address lookup or typed coordinates).
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (status !== "ready" || !map || !lib) return;
    if (!value || !isValidCoordinate(value.lat, value.lng)) { markerRef.current?.remove(); markerRef.current = null; return; }
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = PIN;
      el.className = "cursor-grab";
      el.dataset.testid = "picker-marker";
      const marker = new lib.Marker({ element: el, draggable: true, anchor: "bottom" }).setLngLat([value.lng, value.lat]).addTo(map);
      marker.on("dragend", () => { const p = marker.getLngLat(); onPickRef.current({ lat: round6(p.lat), lng: round6(p.lng) }); });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
    }
    if (!map.getBounds().contains([value.lng, value.lat]) || map.getZoom() < 14) map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 16), duration: 400 });
  }, [status, value]);

  // A newly found postal code: fly to its area (MapLibre jumps instead when the visitor prefers reduced motion).
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || !focus || !isValidCoordinate(focus.lat, focus.lng)) return;
    const key = `${focus.lat},${focus.lng}`;
    if (key === flown.current) return;
    flown.current = key;
    // A marker already inside that area is the better view: keep it instead of zooming out to the area's centre.
    const v = valueRef.current;
    if (v && Math.abs(v.lat - focus.lat) < 0.05 && Math.abs(v.lng - focus.lng) < 0.08) return;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: 13, duration: 900 });
  }, [status, focus]);

  // Without a value, follow the chosen city.
  useEffect(() => {
    const map = mapRef.current;
    if (status === "ready" && map && !value && !focus && fallbackCenter) map.easeTo({ center: [fallbackCenter.lng, fallbackCenter.lat], zoom: 12, duration: 400 });
  }, [status, value, focus, fallbackCenter]);

  return (
    <div className="relative h-80 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-2" data-testid="location-picker" data-status={status} data-focus={focus ? `${focus.lat},${focus.lng}` : undefined}>
      <div className="absolute inset-0"><div ref={box} className="size-full" role="region" aria-label={label} /></div>
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden="true" />}
      {status === "failed" && <div className="absolute inset-0 z-20 grid place-items-center bg-surface-2 p-6 text-center text-sm text-muted" role="status">{unavailable}</div>}
    </div>
  );
}
