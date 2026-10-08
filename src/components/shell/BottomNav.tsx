"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { FigmaIcon } from "@/components/home/FigmaIcon";

/**
 * Mobile tab bar of the approved concept (page 7): the main journeys and search stay within thumb reach. Below `md`
 * only; the footer reserves the same height at its end, so nothing is ever covered. Order follows the page
 * direction, so RTL mirrors it.
 */
const ITEMS = [
  { href: "/", icon: "house", ns: "nav", key: "home" },
  { href: "/businesses", icon: "building-2", ns: "nav", key: "businesses" },
  { href: "/search", icon: "search", ns: "common", key: "search" },
  { href: "/nearby", icon: "map-pin", ns: "nav", key: "nearby" },
  // The brand short form fits a tab in every language; the full localized name is the accessible label.
  { href: "/ai", icon: "sparkles", ns: "nav", key: "ai", short: "REGA AI" },
] as const;

export function BottomNav() {
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  return (
    <nav aria-label={tn("quick")} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" data-testid="bottom-nav">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="min-w-0">
              <Link href={item.href} aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] leading-tight transition-colors ${active ? "font-bold text-brand" : "font-medium text-muted hover:text-ink"}`}>
                <FigmaIcon name={item.icon} className="size-[22px] shrink-0" />
                {"short" in item
                  ? <><span aria-hidden="true" dir="ltr" className="max-w-full truncate">{item.short}</span><span className="sr-only">{tn(item.key)}</span></>
                  : <span className="max-w-full truncate">{item.ns === "nav" ? tn(item.key) : tc(item.key)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
