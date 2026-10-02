import { z } from "zod";
import { normalizeSearch } from "@/lib/text";

export const PER_PAGE = 12;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parses URL search params defensively: unknown/invalid values fall back to defaults, never throw. */
export function parseParams<T extends z.ZodRawShape>(shape: T, raw: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v)]));
  const parsed = z.object(shape).safeParse(flat);
  return parsed.success ? parsed.data : (z.object(shape).parse({}) as z.infer<z.ZodObject<T>>);
}

const id = z.string().trim().max(64).optional().catch(undefined);

export const listShape = {
  q: z.string().trim().max(120).optional().catch(undefined).transform((v) => (v ? v : undefined)),
  category: id,
  city: id,
  page: z.coerce.number().int().min(1).max(500).catch(1),
};

export const businessShape = {
  ...listShape,
  verified: z.enum(["1"]).optional().catch(undefined),
  sort: z.enum(["featured", "rating", "newest", "name"]).catch("featured"),
};

export const serviceShape = {
  ...listShape,
  sort: z.enum(["featured", "priceAsc", "priceDesc", "newest"]).catch("featured"),
};

export const searchShape = {
  q: listShape.q,
  type: z.enum(["all", "businesses", "services", "locations"]).catch("all"),
  page: listShape.page,
};

export const needle = (q?: string) => (q ? normalizeSearch(q) : undefined);

export const contentShape = {
  ...listShape,
  employmentType: z.enum(["full_time", "part_time", "mini_job", "apprenticeship", "internship", "freelance"]).optional().catch(undefined),
  when: z.enum(["upcoming", "past"]).catch("upcoming"),
};
