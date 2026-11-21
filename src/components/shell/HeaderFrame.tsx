"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/routing";

export function HeaderFrame({ brand, search, menu, navigation, children }: {
  brand: ReactNode;
  search: ReactNode;
  menu: ReactNode;
  navigation: ReactNode;
  children: ReactNode;
}) {
  const home = usePathname() === "/";

  return (
    <header className={`rega-header relative z-40 text-white${home ? "" : " rega-header-compact"}`}>
      {children}
      {home && <div className="rega-header-art" aria-hidden="true" />}
      <div dir="ltr" className="rega-header-inner">
        <div className="rega-header-row">
          {home && brand}
          <div className="rega-header-controls">
            {home && search}
            {menu}
          </div>
        </div>
        {home && navigation}
      </div>
    </header>
  );
}
