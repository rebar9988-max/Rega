"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { LogoBadge } from "@/components/ui/Logo";
import { DrIcon, type DrIconName } from "./icons";

export type DrNavItem = { href: string; label: string; icon: DrIconName; group: string };

/**
 * Dashboard navigation: one <nav> for every screen size. From `lg` it is a fixed sidebar; below it the same list
 * opens from a compact top bar, so phone, tablet and desktop show the same items, icons and active state.
 */
export function DrSidebar({ items, groups, email, labels, siteHref }: {
  items: DrNavItem[];
  /** Group key -> visible heading, in display order. */
  groups: [string, string][];
  email: string;
  labels: { nav: string; menu: string; close: string; signedIn: string; site: string };
  siteHref: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navId = useId();
  // A tap on a link navigates; the phone menu closes with it.
  useEffect(() => setOpen(false), [pathname]);
  const active = (href: string) => pathname === href || (href !== "/dr" && pathname.startsWith(`${href}/`));

  return (
    <aside className="sticky top-0 z-40 border-b border-line bg-surface lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-e">
      <div className="flex h-16 items-center justify-between gap-3 px-4 lg:h-[4.5rem] lg:px-5">
        <Link href="/dr" className="rounded-lg"><LogoBadge size={44} priority /></Link>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={navId} data-testid="dr-menu-toggle"
          className="grid size-11 place-items-center rounded-xl border border-line text-ink transition hover:bg-surface-2 lg:hidden">
          <DrIcon name={open ? "close" : "menu"} className="size-5" />
          <span className="sr-only">{open ? labels.close : labels.menu}</span>
        </button>
      </div>
      <div id={navId} className={`${open ? "flex" : "hidden"} max-h-[calc(100dvh-4rem)] flex-col overflow-y-auto border-t border-line lg:flex lg:max-h-none lg:flex-1 lg:border-t-0`}>
        <nav aria-label={labels.nav} className="flex-1 px-3 py-3 lg:py-2">
          {groups.map(([group, heading]) => {
            const list = items.filter((i) => i.group === group);
            if (!list.length) return null;
            return (
              <div key={group} className="mb-4 last:mb-0">
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{heading}</p>
                <ul className="grid gap-0.5">
                  {list.map((i) => {
                    const on = active(i.href);
                    return (
                      <li key={i.href}>
                        <Link href={i.href} aria-current={on ? "page" : undefined}
                          className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${on ? "bg-brand-soft font-semibold text-brand-text" : "font-medium text-ink/80 hover:bg-surface-2 hover:text-ink"}`}>
                          <DrIcon name={i.icon} className={`size-[18px] ${on ? "text-brand-text" : "text-muted"}`} />
                          <span className="min-w-0 truncate">{i.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{email.slice(0, 1).toUpperCase()}</span>
            <p className="min-w-0 text-xs leading-tight text-muted">{labels.signedIn}<bdi dir="ltr" className="block truncate font-semibold text-ink">{email}</bdi></p>
          </div>
          <Link href={siteHref} className="mt-1 flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink">
            <DrIcon name="site" className="size-[18px]" />{labels.site}
          </Link>
        </div>
      </div>
    </aside>
  );
}
