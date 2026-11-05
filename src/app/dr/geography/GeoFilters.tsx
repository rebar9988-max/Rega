"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

/**
 * Filter bar of the geography workspace. Without JavaScript it is a plain GET form; with it, a select applies at
 * once, the search box applies after a short pause, and empty fields are left out of the URL. Choosing another
 * country clears the region (regions belong to one country). The page reads the URL on the server.
 */
export function GeoFilters({ label, pendingLabel, className, children }: { label: string; pendingLabel: string; className: string; children: React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pending, start] = useTransition();

  // Links (tabs, "clear", row shortcuts) change the URL without remounting the fields: show what the URL says.
  useEffect(() => {
    for (const el of Array.from(ref.current?.elements ?? [])) {
      if ((el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && el.type === "search")) && el.name && el !== document.activeElement) {
        el.value = params.get(el.name) ?? "";
      }
    }
  }, [params]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = (form: HTMLFormElement) => {
    clearTimeout(timer.current);
    const next = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v.trim()) next.set(k, v.trim());
    const s = next.toString();
    start(() => router.replace(`/dr/geography${s ? `?${s}` : ""}`, { scroll: false }));
  };

  return (
    <form ref={ref} role="search" aria-label={label} action="/dr/geography" aria-busy={pending} data-pending={pending || undefined} className={className}
      onSubmit={(e) => { e.preventDefault(); apply(e.currentTarget); }}
      onChange={(e) => {
        const el = e.target;
        if (!(el instanceof HTMLSelectElement)) return;
        const form = e.currentTarget;
        if (el.name === "country") { const region = form.elements.namedItem("region"); if (region instanceof HTMLSelectElement) region.value = ""; }
        apply(form);
      }}
      onInput={(e) => {
        const el = e.target;
        if (!(el instanceof HTMLInputElement) || el.type !== "search") return;
        const form = e.currentTarget;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => apply(form), 350);
      }}>
      {children}
      <span aria-live="polite" className="sr-only">{pending ? pendingLabel : ""}</span>
    </form>
  );
}
