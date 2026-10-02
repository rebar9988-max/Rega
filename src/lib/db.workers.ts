/**
 * Prisma client for Cloudflare Workers (OpenNext build). Server-side only.
 * Used instead of `db.ts` when the build runs with REGA_TARGET=workers.
 *
 * - Client: Prisma's WASM query compiler (`@prisma/client/wasm`); Workers cannot load native engines.
 * - Connection: the `HYPERDRIVE` binding when it exists (pooled, low latency), otherwise the DATABASE_URL secret.
 * - One PrismaClient per isolate: each client carries its own WASM query-compiler instance, and one per request
 *   exhausted the isolate (Cloudflare error 1102) after a few requests.
 * - Connections belong to one request: every request gets its own small pool, so a page's queries share a few
 *   connections instead of opening one each (every new connection costs a TLS handshake and a password exchange,
 *   and those added up to 1102 as well). No connection is ever handed to another request, which Workers forbid.
 *   The pool closes its connections shortly after the request's last query; `waitUntil` keeps the request alive
 *   until they are closed.
 * Types still come from "@prisma/client" everywhere else; only this file imports the runtime.
 */
import "server-only";
import { PrismaClient } from "@prisma/client/wasm";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import pg from "pg";

type WorkerEnv = { HYPERDRIVE?: { connectionString: string } };
type Ctx = { waitUntil?: (promise: Promise<unknown>) => void };

/** Connections per request: enough for a page's parallel queries, few enough to keep connection setup cheap. */
const PER_REQUEST = 3;
/** Idle time after which a request's connections are closed. */
const IDLE_MS = 250;
/** Upper bound for keeping a finished request alive while its connections close. */
const CLOSE_WITHIN_MS = 20_000;

const requestPools = new WeakMap<object, pg.Pool>();

function connectionString(): string | undefined {
  const { env } = getCloudflareContext();
  return (env as WorkerEnv).HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL;
}

/** The pool of the request currently running (created on its first query). */
function requestPool(): pg.Pool {
  const { ctx } = getCloudflareContext() as unknown as { ctx: Ctx & object };
  let pool = requestPools.get(ctx);
  if (!pool) {
    const created = new pg.Pool({ connectionString: connectionString(), max: PER_REQUEST, idleTimeoutMillis: IDLE_MS, connectionTimeoutMillis: 5_000 });
    created.on("error", () => { /* a broken idle connection is dropped by the pool; the next query opens a new one */ });
    ctx.waitUntil?.(new Promise<void>((resolve) => {
      const done = setTimeout(() => { void created.end().catch(() => undefined).finally(resolve); }, CLOSE_WITHIN_MS);
      created.on("remove", () => { if (created.totalCount === 0) { clearTimeout(done); resolve(); } });
    }));
    requestPools.set(ctx, created);
    pool = created;
  }
  return pool;
}

/**
 * The pool handed to Prisma. It is a real `pg.Pool` (the adapter requires one) but never opens connections itself:
 * every query and transaction goes to the pool of the request that runs it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
class RequestScopedPool extends pg.Pool {
  query(...args: any[]): any {
    const pool = requestPool();
    return (pool.query as (...a: any[]) => any).apply(pool, args);
  }
  connect(...args: any[]): any {
    const pool = requestPool();
    return (pool.connect as (...a: any[]) => any).apply(pool, args);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let shared: { key: string | undefined; client: PrismaClient } | null = null;

function client(): PrismaClient {
  const key = connectionString();
  if (!shared || shared.key !== key) {
    shared = { key, client: new PrismaClient({ adapter: new PrismaPg(new RequestScopedPool({ max: 1 })), log: ["error"] }) };
  }
  return shared.client;
}

/** Resolved on every access (the connection string comes from the request's environment). */
export const prisma = new Proxy({} as PrismaClient, { get: (_t, prop) => Reflect.get(client(), prop) });
