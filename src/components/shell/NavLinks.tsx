"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";

/**
 * Desktop navigation of design frame 204:912, in the frame's physical order (left to right). Items REGA has no own
 * page for lead to the closest existing section: Market -> businesses, Jobs -> services. The full section list
 * (locations, nearby, AI, contact) stays in the menu sheet (MobileNav, nav.ts).
 */
const ITEMS = [
  { key: "main", href: "/" },
  { key: "market", href: "/businesses" },
  { key: "servicesShort", href: "/services" },
  { key: "jobs", href: "/services", alias: true },
  { key: "aboutUs", href: "/about" },
] as const;

export function NavLinks({ dir }: { dir: "rtl" | "ltr" }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className="flex h-full items-stretch gap-9">
      {ITEMS.map((item) => {
        const active = !("alias" in item) && (item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`));
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
