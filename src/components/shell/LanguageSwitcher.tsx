"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { LOCALES, LOCALE_META } from "@/i18n/locales";

/**
 * Language switcher (native <details> disclosure, works before hydration).
 *
 * Position is deliberately PHYSICAL, not logical: the header renders with dir="ltr" and this menu is anchored
 * with `right-0` to its trigger, so the trigger and the menu sit in exactly the same place in every language.
 * Page direction (RTL/LTR) only affects the text of each item, via `dir` on the label itself.
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");
  const ref = useRef<HTMLDetailsElement>(null);
  const close = (restoreFocus = false) => {
    ref.current?.removeAttribute("open");
    if (restoreFocus) ref.current?.querySelector("summary")?.focus();
  };

  // Close on outside click / focus leaving the widget (details does not do this by itself).
  useEffect(() => {
    const onPointer = (e: Event) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onPointer);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("focusin", onPointer); };
  }, []);

  return (
    <details ref={ref} className="relative" onKeyDown={(e) => e.key === "Escape" && close(true)}>
      <summary aria-label={`${t("language")}: ${LOCALE_META[locale as keyof typeof LOCALE_META]?.nativeName ?? locale}`}
        className="flex min-h-11 w-[4.25rem] cursor-pointer list-none items-center justify-center gap-1.5 rounded-xl px-2 sm:w-20 sm:gap-2 sm:px-3 text-sm font-semibold transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" /></svg>
        <span dir="ltr">{LOCALE_META[locale as keyof typeof LOCALE_META]?.short ?? locale.toUpperCase()}</span>
      </summary>
      <ul dir="ltr" className="absolute right-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-card">
        {LOCALES.map((code) => {
          const meta = LOCALE_META[code];
          const current = code === locale;
          return (
            <li key={code}>
              <Link href={pathname} locale={code} onClick={() => close()} hrefLang={meta.htmlLang}
                aria-current={current ? "true" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand ${current ? "bg-brand-soft font-bold text-brand" : ""}`}>
                <span className="w-5 shrink-0 text-center" aria-hidden="true">{current ? "✓" : ""}</span>
                <span className="min-w-0 flex-1 truncate text-start" lang={meta.htmlLang} dir={meta.dir} style={{ textAlign: "left" }}>{meta.nativeName}</span>
                <span className="text-xs font-semibold text-muted" dir="ltr" aria-hidden="true">{meta.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
