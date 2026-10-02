/** Pagination helpers (pure: safe to import from tests and any runtime). */
import type { ApiMeta } from "@/lib/api-types";

/** Deep offsets are expensive and only useful for scraping; nobody pages past this in the UI. */
const MAX_PAGE = 500;

export type PageParams = { page: number; perPage: number; skip: number; take: number };

/** Reads pagination from a query string, clamped so the DB never returns unbounded sets. */
export function pageParams(url: URL, defaultPerPage = 20, maxPerPage = 100): PageParams {
  const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1));
  const requested = Number.parseInt(url.searchParams.get("perPage") ?? String(defaultPerPage), 10) || defaultPerPage;
  const perPage = Math.min(maxPerPage, Math.max(1, requested));
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export function metaFor(total: number, { page, perPage }: PageParams): ApiMeta {
  return { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

