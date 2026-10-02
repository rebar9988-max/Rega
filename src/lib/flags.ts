/** Feature flags — read server-side and cached per request; progressive rollout by percentage. */
import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

export type FlagKey =
  | "public.aiSearch"
  | "public.reviews"
  | "public.ratings"
  | "public.userAccounts"
  | "public.serviceBooking"
  | "dashboard.bulkActions"
  | "dashboard.analytics";

/** Safe defaults when the flags table has not been seeded yet. */
const DEFAULTS: Record<FlagKey, boolean> = {
  "public.aiSearch": false,
  "public.reviews": false,
  "public.ratings": true,
  "public.userAccounts": true,
  "public.serviceBooking": false,
  "dashboard.bulkActions": true,
  "dashboard.analytics": true,
};

export const loadFlags = cache(async (): Promise<Record<string, { enabled: boolean; rollout: number }>> => {
  try {
    const rows = await prisma.featureFlag.findMany({ select: { key: true, enabled: true, rollout: true } });
    return Object.fromEntries(rows.map((r) => [r.key, { enabled: r.enabled, rollout: r.rollout }]));
  } catch {
    return {};
  }
});

export async function isEnabled(key: FlagKey, bucket = ""): Promise<boolean> {
  const flags = await loadFlags();
  const flag = flags[key];
  if (!flag) return DEFAULTS[key];
  if (!flag.enabled) return false;
  if (flag.rollout >= 100) return true;
  if (flag.rollout <= 0) return false;
  // Deterministic per-subject rollout (stable for a given visitor within a rollout wave).
  let hash = 0;
  const seed = `${key}:${bucket}`;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 1000;
  return hash % 100 < flag.rollout;
}
