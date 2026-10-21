"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { FigmaIcon } from "@/components/home/FigmaIcon";

type Item = { href: string; label: string; icon: string };

/** The same workspace destinations collapse into a disclosure on narrow screens. */
export function BusinessMobileMenu({ items, label }: { items: Item[]; label: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");
  useEffect(() => {
    const outside = (event: Event) => { if (menu.current?.open && !menu.current.contains(event.target as Node)) close(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); };
  }, []);
  return <details ref={menu} className="md:hidden" onKeyDown={(event) => {
    if (event.key === "Escape") { close(); menu.current?.querySelector("summary")?.focus(); }
  }}>
    <summary aria-label={label} className="grid size-11 cursor-pointer list-none place-items-center rounded-xl hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
      <FigmaIcon name="menu" className="size-5" />
    </summary>
    <nav aria-label={label} className="absolute inset-x-3 top-full z-40 rounded-xl border border-line bg-surface p-2 shadow-card">
      {items.map((item) => <Link key={item.href} href={item.href} onClick={close} className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-brand-soft hover:text-brand">
        <FigmaIcon name={item.icon} className="size-5 shrink-0" /><span>{item.label}</span>
      </Link>)}
    </nav>
  </details>;
}
