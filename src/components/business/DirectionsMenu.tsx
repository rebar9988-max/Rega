"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import type { MapLinks } from "@/lib/urls";

/**
 * "Directions": opens a compact menu of map apps, each with the business destination already filled in. Browsers
 * cannot list installed apps, so the common ones are offered; on Android `geo:` also opens the system's own chooser.
 * The visitor's location is never requested.
 */
export function DirectionsMenu({ links, address, label, openWith, otherApp, className, ariaLabel }: {
  links: MapLinks; address: string; label: string; openWith: string; otherApp: string; className: string; ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [android, setAndroid] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => { setAndroid(/Android/i.test(navigator.userAgent)); }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const apps = [
    ...(android ? [{ key: "geo", name: otherApp, href: links.geo }] : []),
    { key: "google", name: "Google Maps", href: links.google },
    { key: "apple", name: "Apple Maps", href: links.apple },
    { key: "waze", name: "Waze", href: links.waze },
  ];

  return (
    // Not positioned itself: the menu anchors to the action row (its positioned parent), so it never leaves the screen.
    <div ref={box}>
      <button ref={button} type="button" className={className} aria-label={ariaLabel} aria-expanded={open} aria-controls={menuId}
        onClick={() => setOpen(!open)} data-testid="directions-button">
        <FigmaIcon name="map-pin" className="size-5 shrink-0" /><span>{label}</span>
      </button>
      {open && (
        <div id={menuId} className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-line bg-surface p-2 shadow-lift sm:max-w-sm" data-testid="directions-menu">
          <p className="px-2 pb-1 pt-1 text-xs font-semibold text-muted">{openWith}</p>
          {address && <p className="px-2 pb-2 text-sm leading-snug" dir="auto">{address}</p>}
          <ul>
            {apps.map((app) => (
              <li key={app.key}>
                <a href={app.href} target={app.key === "geo" ? undefined : "_blank"} rel="noopener noreferrer" onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm font-semibold hover:bg-surface-2" data-testid={`directions-${app.key}`}>
                  <FigmaIcon name="map" className="size-5 shrink-0 text-brand-text" />{app.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
