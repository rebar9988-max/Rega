/** GET /api/v1/health — liveness + configuration report. Never reveals secret values. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isStorageConfigured } from "@/lib/env";
import { isAiConfigured, providerCatalog } from "@/lib/ai";
import { emailEnabled } from "@/lib/email";
import { contentColumnsReady } from "@/lib/schema-readiness";
import { schemaRecoveryReport } from "@/lib/schema-recovery-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let nextRecoveryReportAt = 0;

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
      SELECT table_name::text AS table_name, column_name::text AS column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('City', 'Page', 'PageTranslation', 'Listing', 'ListingTranslation')`;
    contentColumns = contentColumnsReady(columns);
    // Private logs diagnose the configured database without retrieving its secret. Public output stays boolean.
    if (!contentColumns && Date.now() >= nextRecoveryReportAt) {
      nextRecoveryReportAt = Date.now() + 300_000;
      try {
        const history = await prisma.$queryRaw<{ migration_name: string; finished: boolean; rolled_back: boolean }[]>`
          SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
          FROM "_prisma_migrations"`;
        console.info("REGA_DATABASE_PREFLIGHT", JSON.stringify(schemaRecoveryReport(columns, history, process.env.DATABASE_URL)));
      } catch {
        console.warn("REGA_DATABASE_PREFLIGHT unavailable");
      }
    }
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
