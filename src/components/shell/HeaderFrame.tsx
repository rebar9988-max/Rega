"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/routing";

export function HeaderFrame({ homeControls, menu, account, children }: {
  homeControls: ReactNode;
  menu: ReactNode;
  account: ReactNode;
  children: ReactNode;
}) {
  const home = usePathname() === "/";

  return (
    <header className={`rega-header relative z-40 text-white ${home ? "rega-reference-header" : "rega-header-compact"}`} dir="ltr">
      {children}
      {home ? (
        <div className="rega-header-controls rega-reference-controls">
          {homeControls}
          {menu}
          {account}
        </div>
      ) : (
        <div className="rega-header-inner">
          <div className="rega-header-row">
            <div className="rega-header-controls">{menu}</div>
          </div>
        </div>
      )}
    </header>
  );
}
