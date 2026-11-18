"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/routing";

/**
 * Owner request 2026-11-15: the site footer appears on the home page only, not repeated on every page. Elsewhere a
 * phone-only spacer keeps the end of the page clear of the fixed tab bar (BottomNav). Impressum and privacy stay
 * reachable from every page through the menu sheet (MobileNav), as German law requires.
 */
export function HomeOnly({ children }: { children: ReactNode }) {
  if (usePathname() === "/") return <>{children}</>;
  return <div aria-hidden="true" data-testid="tabbar-spacer" className="h-[calc(5.5rem+env(safe-area-inset-bottom))] shrink-0 md:hidden" />;
}
