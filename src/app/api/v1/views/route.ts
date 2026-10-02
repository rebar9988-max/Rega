/**
 * POST /api/v1/views — count a business page view.
 * Public and write-only, so it is deliberately cheap to abuse-proof: one increment per
 * (client, business) per 30 minutes, and only for published businesses.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleError, ok } from "@/lib/api";
import { clientIp } from "@/lib/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 30 * 60_000;
const MAX_KEYS = 20_000;
const seen = new Map<string, number>();

function firstSeen(key: string): boolean {
  const now = Date.now();
  const last = seen.get(key);
  if (last && now - last < WINDOW_MS) return false;
  if (seen.size >= MAX_KEYS) seen.clear(); // bounded memory; worst case a few extra counts
  seen.set(key, now);
  return true;
}

const schema = z.object({ slug: z.string().trim().min(1).max(200) });

export async function POST(request: NextRequest) {
  try {
    const { slug } = schema.parse(await request.json());
    const client = clientIp(request.headers);
    if (firstSeen(`${client}:${slug}`)) {
      await prisma.business.updateMany({ where: { slug, status: "published", deletedAt: null }, data: { viewCount: { increment: 1 } } });
    }
    return ok({ counted: true });
  } catch (error) {
    return handleError(error, "views");
  }
}
