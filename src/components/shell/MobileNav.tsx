"use client";

import { useLocale, useTranslations } from "next-intl";
import { dirOf } from "@/i18n/locales";
import { useRef } from "react";
import { Link, usePathname } from "@/i18n/routing";
import type { NavItem } from "./nav";

/** Full-height sheet built on native <dialog>: focus trap, Escape and inert background for free. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const contentDir = dirOf(useLocale());
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" aria-label={t("menu")} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}
        className="grid size-11 place-items-center rounded-xl hover:bg-surface-2 xl:hidden">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <dialog ref={dialog} aria-label={t("menu")}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-surface p-4 text-ink shadow-card backdrop:bg-black/50 ml-auto">
        <div className="mb-4 flex justify-end">
          <button type="button" aria-label={tc("close")} onClick={() => dialog.current?.close()}
            className="grid size-11 place-items-center rounded-xl hover:bg-surface-2">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <nav aria-label={t("primary")} dir={contentDir}>
          <ul className="flex flex-col gap-1">
            {/* Registry order (home first); login before contact, and contact always last. */}
            {[...items.filter((i) => i.key !== "contact"), { key: "login", href: "/login" }, ...items.filter((i) => i.key === "contact")].map((item) => (
              <li key={item.key}>
                <Link href={item.href} onClick={() => dialog.current?.close()}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={`flex min-h-12 items-center rounded-xl px-4 text-base font-semibold hover:bg-surface-2 ${pathname === item.href ? "bg-brand-soft text-brand" : ""}`}>
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}
