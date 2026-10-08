"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import type { NavItem } from "./nav";

/**
 * Desktop navigation (approved red/white concept). The items come from the section registry
 * (`headerNav()` in nav.ts), the same source as the menu sheet and the footer, so every section has one name everywhere.
 */
export function NavLinks({ dir, items }: { dir: "rtl" | "ltr"; items: NavItem[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className="flex h-full items-stretch gap-6 2xl:gap-8">
      {items.map((item) => {
        const active = (item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <li key={item.key}>
            {/* Approved concept: vertically centred label, a short red bar under the current section. */}
            <Link href={item.href} dir={dir} aria-current={active ? "page" : undefined}
              className={`relative flex h-full items-center whitespace-nowrap text-[14px] transition-colors hover:text-brand ${active ? "font-bold text-brand" : "font-medium text-ink"}`}>
              <span>{t(item.key)}</span>
              <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-[3px] rounded-t-full ${active ? "bg-brand" : "bg-transparent"}`} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
