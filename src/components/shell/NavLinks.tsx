"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import type { NavItem } from "./nav";

/**
 * Desktop navigation of design frame 204:912 (look unchanged). The items come from the section registry
 * (`headerNav()` in nav.ts), the same source as the menu sheet and the footer, so every section has one name everywhere.
 */
export function NavLinks({ dir, items }: { dir: "rtl" | "ltr"; items: NavItem[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className="flex h-full items-stretch gap-9">
      {items.map((item) => {
        const active = (item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <li key={item.key}>
            <Link href={item.href} dir={dir} aria-current={active ? "page" : undefined}
              className={`flex h-full flex-col items-center justify-between whitespace-nowrap pt-[31px] text-[13px] transition-colors hover:text-brand ${active ? "font-bold text-brand" : "font-medium text-ink"}`}>
              <span className="leading-[27px]">{t(item.key)}</span>
              <span aria-hidden="true" className={`size-[5px] rounded-full ${active ? "bg-brand" : "bg-transparent"}`} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
