/**
 * API envelope + helpers shared by every /api/v1 route.
 * Response shape is stable so web, iOS, Android and admin clients can share it.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/auth-helpers";
import { log } from "@/lib/logger";

export type { ApiMeta } from "@/lib/api-types";
import type { ApiMeta } from "@/lib/api-types";

export function ok<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json({ ok: true, data, ...(meta ? { meta } : {}) }, { status });
}

export function created<T>(data: T) {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

/** Maps any thrown value onto a stable API error response. */
export function handleError(error: unknown, context: string) {
  if (error instanceof HttpError) {
    return fail(error.status, error.code, error.message);
  }
  if (error instanceof ZodError) {
    return fail(422, "validation_error", "The submitted data is invalid.", error.flatten());
  }
  log.error("api.unhandled", { context, error: error instanceof Error ? error.message : String(error) });
  return fail(500, "internal_error", "An internal error occurred.");
}

export { pageParams, metaFor, type PageParams } from "@/lib/paging";

/** Builds a Prisma `orderBy` from ?sort=field:dir, restricted to an allow-list. */
export function orderBy(url: URL, allowed: string[], fallback = "createdAt"): Record<string, "asc" | "desc"> {
  const raw = url.searchParams.get("sort");
  if (!raw) return { [fallback]: "desc" };
  const [field, dir] = raw.split(":");
  if (!allowed.includes(field)) return { [fallback]: "desc" };
  return { [field]: dir === "asc" ? "asc" : "desc" };
}

export { normalizeSearch } from "@/lib/text";
import { normalizeBasic } from "@/lib/text";

/** URL slug. Built from the basic normalization (not the search folding), so existing slug rules are unchanged. */
export function slugify(input: string): string {
  const base = normalizeBasic(input)
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `item-${Date.now().toString(36)}`;
}
