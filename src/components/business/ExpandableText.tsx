"use client";

import { useState, type ReactNode } from "react";

/** Long text shown as a few lines with a "read more" toggle; short text is shown whole, without a toggle. */
export function ExpandableText({ children, long, more, less }: { children: ReactNode; long: boolean; more: string; less: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`whitespace-pre-line text-pretty leading-relaxed text-muted ${long && !open ? "line-clamp-4" : ""}`}>{children}</div>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand hover:text-brand">
          {open ? less : more}
          <svg viewBox="0 0 24 24" className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      )}
    </>
  );
}
