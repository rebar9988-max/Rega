/**
 * Locale routing middleware.
 * - /            -> /{defaultLocale}      (Kurdish Sorani)
 * - /x, /y/...   -> locale-prefixed paths are passed through, with the locale cookie refreshed
 * - /dr/… , /api/… -> untouched (management dashboard, auth endpoints, REST API)
 */
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/locales";

const intlMiddleware = createMiddleware({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeDetection: true,
});

const LOCALE_SET = new Set<string>(LOCALES as readonly string[]);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Staff dashboard, API and auth routes are not localized.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dr") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const response = intlMiddleware(request);

  // Persist the visitor's language choice so the account, AI answers and emails follow it too.
  const segment = pathname.split("/")[1];
  if (segment && LOCALE_SET.has(segment)) {
    response.cookies.set("REGA_LOCALE", segment, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|dr|_next|_vercel|.*\\..*).*)"],
};
