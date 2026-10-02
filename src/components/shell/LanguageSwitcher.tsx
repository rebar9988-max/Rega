"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { LOCALES, LOCALE_META } from "@/i18n/locales";

/** Short language name on the trigger (design frame 204:912 shows "کوردی"). */
const TRIGGER_LABEL: Record<string, string> = { ckb: "کوردی", kmr: "Kurmancî", de: "Deutsch", en: "English", ar: "العربية", fa: "فارسی", tr: "Türkçe" };

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

  // xl: the trigger box is 25px wider than the frame's 47px (room for every language name); the negative margin keeps
  // the frame's geometry.
  return (
    <details ref={ref} className="relative xl:-ms-[25px]" onKeyDown={(e) => e.key === "Escape" && close(true)}>
      {/* Design frame 204:912: language name + chevron. Fixed width so the trigger never moves between languages. */}
      <summary aria-label={`${t("language")}: ${LOCALE_META[locale as keyof typeof LOCALE_META]?.nativeName ?? locale}`}
        className="flex min-h-11 w-[4.5rem] cursor-pointer list-none items-center justify-end gap-[5px] rounded-xl text-[12px] font-normal text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <span className="whitespace-nowrap" lang={LOCALE_META[locale as keyof typeof LOCALE_META]?.htmlLang}>{TRIGGER_LABEL[locale] ?? locale.toUpperCase()}</span>
        <svg viewBox="0 0 24 24" className="size-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
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
