/** GET /api/v1/health — liveness + configuration report. Never reveals secret values. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isStorageConfigured } from "@/lib/env";
import { isAiConfigured, providerCatalog } from "@/lib/ai";
import { emailEnabled } from "@/lib/email";
import { contentColumnsReady } from "@/lib/schema-readiness";
import { schemaRecoveryReport } from "@/lib/schema-recovery-report";
import { usesD1 } from "@/lib/d1-connection";

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
    if (usesD1()) {
      const history = await prisma.$queryRaw<{ count: number }[]>`SELECT count(*) AS count FROM d1_migrations WHERE name IN ('0001_initial.sql', '0002_runtime.sql', '0003_city_slug_fold.sql', '0004_business_social_links.sql')`;
      const revision = await prisma.$queryRaw<{ revision: number }[]>`SELECT revision FROM "_RegaRevision" WHERE id=1`;
      migrations = Number(history[0]?.count) === 4 && revision.length === 1;
      const columns = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
        SELECT m.name AS table_name, p.name AS column_name FROM sqlite_master m JOIN pragma_table_info(m.name) p
        WHERE m.type='table' AND m.name IN ('City','Page','PageTranslation','Listing','ListingTranslation')`;
      contentColumns = contentColumnsReady(columns);
    } else {
    const rows = await prisma.$queryRaw<{ count: bigint; failed_count: bigint }[]>`
      SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS count,
             count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS failed_count
      FROM "_prisma_migrations"`;
    migrations = Number(rows[0]?.count ?? 0) > 0 && Number(rows[0]?.failed_count ?? 0) === 0;
    const columns = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name::text AS table_name, column_name::text AS column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('City', 'Page', 'PageTranslation', 'Listing', 'ListingTranslation')`;
    contentColumns = contentColumnsReady(columns);
    // Private logs diagnose the configured database without retrieving its secret. Public output stays boolean.
    if (!contentColumns && Date.now() >= nextRecoveryReportAt) {
      nextRecoveryReportAt = Date.now() + 300_000;
      try {
        const history = await prisma.$queryRaw<{ migration_name: string; checksum: string; finished: boolean; rolled_back: boolean }[]>`
          SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
          FROM "_prisma_migrations"`;
        console.info("REGA_DATABASE_PREFLIGHT", JSON.stringify(schemaRecoveryReport(columns, history, process.env.DATABASE_URL)));
      } catch {
        console.warn("REGA_DATABASE_PREFLIGHT unavailable");
      }
    }
    }
  } catch {
    database = "error";
  }

  // Configuration must never turn the health report into an empty 500: report WHICH required variables are
  // missing (names only, never values) so a misconfigured deployment can be diagnosed from the outside.
  const missingEnv = (usesD1() ? ["AUTH_SECRET"] : ["DATABASE_URL", "AUTH_SECRET"]).filter((k) => !process.env[k]);
  const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

  const body = {
    ok: database === "ok" && migrations && contentColumns,
    service: "rega-platform",
    env: process.env.APP_ENV ?? process.env.NODE_ENV ?? "unknown",
    time: new Date().toISOString(),
    latencyMs: Date.now() - started,
    checks: {
      database,
      databaseProvider: usesD1() ? "d1" : "postgres",
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
