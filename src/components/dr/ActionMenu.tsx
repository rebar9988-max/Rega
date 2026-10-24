"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DrIcon } from "./icons";

/**
 * Compact "more actions" menu for one record (disclosure pattern: a button that shows a list of actions).
 * The panel stays mounted while closed, so confirmation dialogs opened from it keep their state; it closes on
 * Escape, on a click outside and after an action. Opens upwards when there is no room below.
 */
export function ActionMenu({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(panel.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    const rect = panel.current?.getBoundingClientRect();
    setUp(Boolean(rect && rect.bottom > window.innerHeight - 8 && rect.top - rect.height - 48 > 0));
    items()[0]?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node) && !(e.target as Element).closest?.("dialog")) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) { setOpen(false); trigger.current?.focus(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const list = items();
      const at = list.indexOf(document.activeElement as HTMLElement);
      if (at === -1) return;
      e.preventDefault();
      list[(at + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); setUp(false); };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button ref={trigger} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} data-testid={testId}
        className={`grid size-9 place-items-center rounded-lg border text-ink transition ${open ? "border-ink/20 bg-surface-2" : "border-line bg-surface hover:bg-surface-2"}`}>
        <DrIcon name="more" className="size-[18px]" />
        <span className="sr-only">{label}</span>
      </button>
      <div id={id} ref={panel} hidden={!open}
        // Any action inside (following a link, submitting a form, opening a confirmation) closes the menu.
        onClick={(e) => { if ((e.target as Element).closest("a[href], [data-menu-close]")) setOpen(false); }}
        onSubmit={() => setOpen(false)}
        className={`absolute end-0 z-30 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-lift ${up ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}>
        {children}
      </div>
    </div>
  );
}

/** Shared look of a menu row (link or submit button). */
export const menuItem = "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-sm font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-50";
export const menuItemDanger = "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-sm font-semibold text-brand transition-colors hover:bg-brand-soft focus-visible:bg-brand-soft disabled:opacity-50";

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
