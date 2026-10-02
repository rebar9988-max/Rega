"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { NAV_ITEMS } from "./nav";

/** Primary navigation with the active page marked by the REGA red underline (design reference). */
export function NavLinks({ dir }: { dir: "rtl" | "ltr" }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = [{ key: "home", href: "/" }, ...NAV_ITEMS];
  return (
    <ul className="flex items-center gap-0.5">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.key}>
            <Link href={item.href} dir={dir} aria-current={active ? "page" : undefined}
              className={`relative flex min-h-11 items-center whitespace-nowrap rounded-xl px-2 text-sm font-semibold transition-colors hover:text-brand 2xl:px-3 ${active ? "text-brand" : "text-ink/80"}`}>
              {t(item.key)}
              {active && <span aria-hidden="true" className="absolute inset-x-2 -bottom-1 h-[3px] rounded-full bg-brand" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
