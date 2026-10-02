/** GET /api/v1/health — liveness + configuration report. Never reveals secret values. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isStorageConfigured } from "@/lib/env";
import { isAiConfigured, providerCatalog } from "@/lib/ai";
import { emailEnabled } from "@/lib/email";
import { contentColumnsReady } from "@/lib/schema-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "error";
  let migrations = false;
  let contentColumns = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "ok";
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "_prisma_migrations"`;
    migrations = Number(rows[0]?.count ?? 0) > 0;
    const columns = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('City', 'Page', 'PageTranslation', 'Listing', 'ListingTranslation')`;
    contentColumns = contentColumnsReady(columns);
  } catch {
    database = "error";
  }

  // Configuration must never turn the health report into an empty 500: report WHICH required variables are
  // missing (names only, never values) so a misconfigured deployment can be diagnosed from the outside.
  const missingEnv = ["DATABASE_URL", "AUTH_SECRET"].filter((k) => !process.env[k]);
  const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

  const body = {
    ok: database === "ok" && migrations && contentColumns,
    service: "rega-platform",
    env: process.env.APP_ENV ?? process.env.NODE_ENV ?? "unknown",
    time: new Date().toISOString(),
    latencyMs: Date.now() - started,
    checks: {
      database,
      migrations,
      contentColumns,
      auth: Boolean(process.env.AUTH_SECRET),
      storage: safe(isStorageConfigured, false),
      ai: safe(isAiConfigured, false),
      email: safe(emailEnabled, false),
      missingEnv,
      aiProviders: safe(() => providerCatalog().filter((p) => p.hasKey).length, 0), // count only, never names or keys
    },
  };

  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
