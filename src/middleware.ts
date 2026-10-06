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

/** Category id -> slug, fetched from the public categories API and kept for ten minutes (the middleware cannot reach the database). */
let slugById = new Map<string, string>();
let slugsLoadedAt = 0;
async function categorySlug(request: NextRequest, id: string): Promise<string | undefined> {
  if (Date.now() - slugsLoadedAt > 10 * 60_000 || !slugById.has(id)) {
    try {
      const res = await fetch(new URL("/api/v1/categories", request.url), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(2_500) });
      const body = (await res.json()) as { data?: { id: string; slug: string }[] };
      if (res.ok && body.data) { slugById = new Map(body.data.map((c) => [c.id, c.slug])); slugsLoadedAt = Date.now(); }
    } catch { /* lookup unavailable: the page redirects instead (308) */ }
  }
  return slugById.get(id);
}

/** Old filter URLs /<locale>/businesses?category=<id> become /<locale>/businesses/<category-slug> with a 301. */
const OLD_CATEGORY_URL = /^\/([a-z]{2,3})\/businesses\/?$/;
async function redirectOldCategoryUrl(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, searchParams } = request.nextUrl;
  const m = OLD_CATEGORY_URL.exec(pathname);
  const id = searchParams.get("category");
  if (!m || !id || !LOCALE_SET.has(m[1]) || !/^[\w-]{8,64}$/.test(id)) return null;
  const slug = await categorySlug(request, id);
  if (!slug) return null;
  const rest = new URLSearchParams(searchParams);
  rest.delete("category");
  return NextResponse.redirect(new URL(`/${m[1]}/businesses/${slug}${rest.size ? `?${rest}` : ""}`, request.url), 301);
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Staff dashboard, API and auth routes are not localized.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dr") ||
    pathname.startsWith("/owner-login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/sitemaps/")
  ) {
    return NextResponse.next();
  }

  const moved = await redirectOldCategoryUrl(request);
  if (moved) return moved;

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
