"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { badgeText, type AdminNotification } from "./build";

/**
 * Bell with a REGA-red count badge and a small list of what is waiting. Data comes from the server
 * (getAdminNotifications); this component only opens and closes. Escape and outside clicks close it.
 * Placed in the dashboard's top bar (app/dr/layout.tsx).
 */
export function NotificationBell({ items, labels }: { items: (AdminNotification & { label: string })[]; labels: { title: string; empty: string } }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useId();
  const total = items.reduce((sum, n) => sum + n.count, 0);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <div ref={root} className="relative" data-testid="notification-bell">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((v) => !v)}
        aria-label={total > 0 ? `${labels.title} (${total})` : labels.title}
        className="relative grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink hover:border-brand hover:text-brand-text focus-visible:outline-2 focus-visible:outline-brand">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {total > 0 && <span className="absolute -end-1.5 -top-1.5 min-w-5 rounded-full bg-brand px-1 text-center text-[11px] font-bold leading-5 text-brand-ink" aria-hidden="true">{badgeText(total)}</span>}
      </button>
      {open && (
        <div id={panel} className="absolute end-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-2 shadow-sm">
          <p className="px-2 py-1.5 text-sm font-bold">{labels.title}</p>
          {items.length === 0 ? <p className="px-2 pb-2 text-sm text-muted">{labels.empty}</p> : (
            <ul>
              {items.map((n) => (
                <li key={n.kind}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 text-sm hover:bg-surface-2">
                    <span className="min-w-0">{n.label}</span>
                    <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-text">{n.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
