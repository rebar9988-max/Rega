/**
 * Prisma client for Cloudflare Workers (OpenNext build). Server-side only.
 * Used instead of `db.ts` when the build runs with REGA_TARGET=workers.
 *
 * - Client: Prisma's WASM query compiler (`@prisma/client/wasm`); Workers cannot load native engines.
 * - Connection: the `HYPERDRIVE` binding when it exists (pooled, low latency), otherwise the DATABASE_URL secret.
 * - One client per request: Workers must not reuse TCP connections across requests, hence `maxUses: 1`.
 * Types still come from "@prisma/client" everywhere else; only this file imports the runtime.
 */
import "server-only";
import { PrismaClient } from "@prisma/client/wasm";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type WorkerEnv = { HYPERDRIVE?: { connectionString: string } };

const perRequest = new WeakMap<object, PrismaClient>();

function client(): PrismaClient {
  const { env, ctx } = getCloudflareContext();
  let c = perRequest.get(ctx);
  if (!c) {
    const connectionString = (env as WorkerEnv).HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL;
    const adapter = new PrismaPg({ connectionString, max: 5, maxUses: 1, connectionTimeoutMillis: 5_000 });
    c = new PrismaClient({ adapter, log: ["error"] });
    perRequest.set(ctx, c);
  }
  return c;
}

/** Resolved on every access so each request gets its own client. */
export const prisma = new Proxy({} as PrismaClient, { get: (_t, prop) => Reflect.get(client(), prop) });
