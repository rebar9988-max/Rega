/**
 * Prisma client for Cloudflare Workers (OpenNext build). Server-side only.
 * Used instead of `db.ts` when the build runs with REGA_TARGET=workers.
 *
 * - Client: Prisma's WASM query compiler (`@prisma/client/wasm`); Workers cannot load native engines.
 * - Connection: the `HYPERDRIVE` binding when it exists (pooled, low latency), otherwise the DATABASE_URL secret.
 * - One client per isolate: a PrismaClient carries its own WASM query-compiler instance, and a new one per request
 *   (never released) grew the isolate's memory until Cloudflare stopped it with error 1102 after a few requests.
 * - No TCP connection is shared between requests: `maxUses: 1` closes every connection after its single use, so each
 *   query opens its own socket inside the request that runs it (Workers forbid I/O objects across requests).
 * Types still come from "@prisma/client" everywhere else; only this file imports the runtime.
 */
import "server-only";
import { PrismaClient } from "@prisma/client/wasm";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type WorkerEnv = { HYPERDRIVE?: { connectionString: string } };

let shared: { connectionString: string | undefined; client: PrismaClient } | null = null;

function client(): PrismaClient {
  const { env } = getCloudflareContext();
  const connectionString = (env as WorkerEnv).HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL;
  if (!shared || shared.connectionString !== connectionString) {
    // A roomy pool: with a free slot every query opens its connection in its own request. Only a full pool would hand a
    // connection opened in one request to another request waiting in its queue (not allowed on Workers).
    const adapter = new PrismaPg({ connectionString, max: 64, maxUses: 1, connectionTimeoutMillis: 5_000 });
    shared = { connectionString, client: new PrismaClient({ adapter, log: ["error"] }) };
  }
  return shared.client;
}

/** Resolved on every access (the connection string comes from the request's environment). */
export const prisma = new Proxy({} as PrismaClient, { get: (_t, prop) => Reflect.get(client(), prop) });
