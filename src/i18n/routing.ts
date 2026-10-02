import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { DEFAULT_LOCALE, LOCALES } from "./locales";

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

/** Locale-aware Link / usePathname / useRouter. Use these instead of next/link in localized pages. */
export const { Link, usePathname, useRouter } = createNavigation(routing);
