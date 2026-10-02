import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

export default getRequestConfig(async ({ requestLocale }) => {
  // Non-localized areas (the /dr staff dashboard) have no locale segment: use the visitor's saved choice.
  const requested = (await requestLocale) ?? (await cookies()).get("REGA_LOCALE")?.value;
  const locale: Locale = requested && isLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "Europe/Berlin",
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: "2-digit", month: "2-digit", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
      },
      number: {
        precise: { maximumFractionDigits: 2 },
      },
    },
  };
});
