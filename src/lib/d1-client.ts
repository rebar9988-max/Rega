/** Shared WASM client for D1. Explicit/implicit non-atomic Prisma transactions fail closed. */
import { PrismaD1 } from "@prisma/adapter-d1";
import type { PrismaClient as SqliteClient } from "@rega/d1-client";
import type { PrismaClient } from "@prisma/client";
import { D1_FOLDS, d1Arguments } from "./d1-fold";
import { d1Connection } from "./d1-connection";
import { d1Transaction } from "./d1-transaction";
import { d1Models } from "./d1-models";
import { mapD1Nulls, type D1Nulls } from "./d1-null";

export function createD1Client(Client: typeof SqliteClient, nulls: D1Nulls): PrismaClient {
  const binding = {
    prepare: (sql: string) => d1Connection().prepare(sql),
    batch: (statements: Parameters<ReturnType<typeof d1Connection>["batch"]>[0]) => d1Connection().batch(statements),
  };
  const factory = new PrismaD1(binding as unknown as ConstructorParameters<typeof PrismaD1>[0]);
  const connect = factory.connect.bind(factory);
  factory.connect = async () => {
    const adapter = await connect();
    // Imported timestamps and planned writes use UTC epoch milliseconds. PrismaD1's default
    // converts filter dates to ISO text, which SQLite cannot compare with numeric timestamps.
    const normalizeDates = (query: Parameters<typeof adapter.queryRaw>[0]) => ({
      ...query,
      args: query.args.map((value, index) => {
        if (value == null || query.argTypes[index]?.scalarType !== "datetime") return value;
        const time = new Date(value as string | number | Date).getTime();
        if (!Number.isFinite(time)) throw new Error("Invalid D1 query date");
        return time;
      }),
    });
    const queryRaw = adapter.queryRaw.bind(adapter);
    const executeRaw = adapter.executeRaw.bind(adapter);
    adapter.queryRaw = query => queryRaw(normalizeDates(query));
    adapter.executeRaw = query => executeRaw(normalizeDates(query));
    adapter.startTransaction = async () => { throw new Error("D1 requires an atomic batch; unconverted Prisma transaction refused"); };
    return adapter;
  };
  const omit = Object.fromEntries(Object.entries(D1_FOLDS).map(([model, fields]) => [model[0].toLowerCase() + model.slice(1), Object.fromEntries(Object.values(fields).map(f => [f, true]))]));
  const client = new Client({ adapter: factory, omit });
  const extended = client.$extends({
    query: {
      $allModels: {
        $allOperations({ model, args, query }) {
          return query(d1Arguments(model, args) as typeof args);
        },
      },
    },
  });
  const models = new Set([...d1Models.keys()].map(name => name[0].toLowerCase() + name.slice(1)));
  const writes = new Set(["create", "createMany", "createManyAndReturn", "update", "upsert", "delete", "updateMany", "deleteMany"]);
  const delegates = new Map<string, object>();
  // Intercept before Prisma's argument cloning: otherwise a null sentinel from the PostgreSQL
  // type client is reduced to an empty JSON object by the separate SQLite runtime.
  const ready = new Proxy(extended, { get(target, property, receiver) {
    // Reject at property access, before array arguments can start individual writes.
    if (property === "$transaction") throw new Error("D1 requires an atomic batch; unconverted Prisma transaction refused");
    const value = Reflect.get(target, property, receiver);
    if (typeof property === "string" && models.has(property)) {
      if (!delegates.has(property)) delegates.set(property, new Proxy(value, { get(delegate, operation) {
        if (writes.has(String(operation))) return (args: unknown) => d1Transaction(ready as unknown as PrismaClient, tx => (tx as unknown as Record<string, Record<string, (args: unknown) => Promise<unknown>>>)[property][String(operation)](args));
        const member = Reflect.get(delegate, operation);
        return typeof member === "function" ? (...args: unknown[]) => member.apply(delegate, args.map(a => mapD1Nulls(a, nulls))) : member;
      } }));
      return delegates.get(property);
    }
    return typeof value === "function" ? value.bind(target) : value;
  } });
  return ready as unknown as PrismaClient;
}
