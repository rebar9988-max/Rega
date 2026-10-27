/**
 * Optimistic D1 transactions: Prisma performs filtered reads; scalar writes and their
 * read-your-writes projections are planned, then committed in one guarded native batch.
 * Unsupported operations fail before a write. No Prisma transaction is silently ignored.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { d1Atomic, type D1Plan, newId } from "./d1-plan";
import { d1Models as models, type D1Model as Model } from "./d1-models";

type Row = Record<string, unknown>;
type Args = { where?: Row; data?: Row; create?: Row; update?: Row; select?: Row; include?: Row; orderBy?: Row | Row[]; take?: number; skip?: number };
const object = (v: unknown): v is Row => v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !Prisma.Decimal.isDecimal(v);
const delegate = (m: string) => m[0].toLowerCase() + m.slice(1);
const comparable = (v: unknown): string | number | null | undefined => v instanceof Date ? v.getTime() : Prisma.Decimal.isDecimal(v) ? v.toNumber() : v as string | number | null | undefined;
function missing(): never { throw new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: Prisma.prismaVersion.client }); }
function key(model: Model, row: Row): string {
  const fields = model.primaryKey?.fields ?? model.fields.filter(f => f.isId).map(f => f.name);
  if (!fields.length) throw new Error("Model without a primary key is unsupported");
  return JSON.stringify(fields.map(f => row[f]));
}
function flatten(model: Model, where: Row = {}): Row {
  const out: Row = {};
  for (const [name, value] of Object.entries(where)) {
    if (!model.fields.some(f => f.name === name) && !["AND", "OR", "NOT"].includes(name) && object(value)) Object.assign(out, value);
    else out[name] = value;
  }
  return out;
}
function matches(row: Row, where: Row): boolean {
  for (const [name, filter] of Object.entries(where)) {
    if (filter === undefined) continue;
    const list = Array.isArray(filter) ? filter : [filter];
    if (name === "AND") { if (!list.every(f => object(f) && matches(row, f))) return false; continue; }
    if (name === "OR") { if (!list.some(f => object(f) && matches(row, f))) return false; continue; }
    if (name === "NOT") { if (list.some(f => object(f) && matches(row, f))) return false; continue; }
    let value = row[name];
    if (!object(filter)) { if (comparable(value) !== comparable(filter)) return false; continue; }
    if (filter.mode === "insensitive" && typeof value === "string") value = value.toLowerCase();
    if (Array.isArray(filter.path)) {
      value = filter.path.reduce<unknown>((v, p) => object(v) ? v[String(p)] : undefined, value);
    }
    for (const [op, original] of Object.entries(filter)) {
      if (op === "mode" || op === "path") continue;
      const expected = filter.mode === "insensitive" ? (typeof original === "string" ? original.toLowerCase() : Array.isArray(original) ? original.map(v => typeof v === "string" ? v.toLowerCase() : v) : original) : original;
      const a = comparable(value), b = comparable(expected);
      if (op === "equals") { if (a !== b) return false; }
      else if (op === "in") { if (!Array.isArray(expected) || !expected.some(v => comparable(v) === a)) return false; }
      else if (op === "notIn") { if (!Array.isArray(expected) || expected.some(v => comparable(v) === a)) return false; }
      else if (op === "contains" || op === "startsWith" || op === "endsWith") {
        if (typeof a !== "string" || typeof b !== "string" || !(op === "contains" ? a.includes(b) : op === "startsWith" ? a.startsWith(b) : a.endsWith(b))) return false;
      } else if (op === "gt" || op === "gte" || op === "lt" || op === "lte") {
        if (a == null || b == null || !(op === "gt" ? a > b : op === "gte" ? a >= b : op === "lt" ? a < b : a <= b)) return false;
      } else if (op === "not") { if (matches({ v: value }, { v: expected })) return false; }
      else throw new Error(`Unsupported staged filter ${op}`);
    }
  }
  return true;
}
function scalarData(model: Model, input: Row, previous?: Row): Row {
  const result: Row = {};
  for (const [name, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const field = model.fields.find(f => f.name === name);
    if (!field || field.kind === "object") throw new Error(`Nested or unknown D1 write refused: ${model.name}.${name}`);
    if (value !== Prisma.DbNull && value !== Prisma.JsonNull && object(value) && field.type !== "Json" && !field.isList) {
      const entries = Object.entries(value);
      if (entries.length !== 1) throw new Error("Unsupported scalar operation");
      const [op, operand] = entries[0];
      if (op === "set") result[name] = operand;
      else if (op === "increment" || op === "decrement") result[name] = Number(previous?.[name] ?? 0) + Number(operand) * (op === "increment" ? 1 : -1);
      else throw new Error(`Unsupported D1 scalar operation ${op}`);
    } else result[name] = field.type === "Decimal" && value != null ? new Prisma.Decimal(value as string | number).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      : field.isDateOnly && value instanceof Date ? new Date(Math.floor(value.getTime() / 86_400_000) * 86_400_000) : value;
  }
  for (const field of model.fields) {
    if (field.isUpdatedAt) result[field.name] = new Date();
    if (previous || field.kind === "object" || field.name in result) continue;
    if (field.hasDefaultValue) {
      const value = field.default;
      if (object(value) && value.name === "now") result[field.name] = new Date();
      else if (object(value) && ["cuid", "uuid"].includes(String(value.name))) result[field.name] = newId();
      else if (field.type === "Json" && typeof value === "string") result[field.name] = JSON.parse(value);
      else result[field.name] = value;
    } else if (!field.isRequired) result[field.name] = null;
    else if (!field.isUpdatedAt) throw new Error(`Missing D1 field ${model.name}.${field.name}`);
  }
  return result;
}

class Transaction {
  readonly changed = new Map<string, Map<string, { row: Row; deleted: boolean }>>();
  constructor(readonly db: PrismaClient, readonly plan: D1Plan) {}
  changes(model: Model) {
    let map = this.changed.get(model.name);
    if (!map) { map = new Map(); this.changed.set(model.name, map); }
    return map;
  }
  async rows(model: Model, args: Args): Promise<Row[]> {
    const where = flatten(model, args.where);
    const base = (this.db as unknown as Record<string, { findMany(args: Row): Promise<Row[]> }>)[delegate(model.name)];
    const rows = await base.findMany({ where });
    const found = new Map(rows.map(row => [key(model, row), row]));
    for (const [id, change] of this.changes(model)) {
      if (change.deleted || !matches(change.row, where)) found.delete(id);
      else found.set(id, change.row);
    }
    let result = [...found.values()];
    const order = args.orderBy ? Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy] : [];
    if (order.length) result.sort((a, b) => {
      for (const rule of order) for (const [field, direction] of Object.entries(rule)) {
        const av = comparable(a[field]), bv = comparable(b[field]);
        if (av === bv) continue;
        const comparison = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : 1;
        return comparison * (direction === "desc" ? -1 : 1);
      }
      return 0;
    });
    const skip = args.skip ?? 0;
    if (skip || args.take !== undefined) result = result.slice(skip, args.take === undefined ? undefined : skip + args.take);
    return result;
  }
  async relation(model: Model, row: Row, name: string, args: Args): Promise<unknown> {
    const field = model.fields.find(f => f.name === name && f.kind === "object");
    const target = field && models.get(field.type);
    if (!field || !target) throw new Error("Unknown D1 relation");
    let link: Row;
    if (field.relationFromFields?.length) {
      if (field.relationFromFields.some(f => row[f] == null)) return null;
      link = Object.fromEntries(field.relationFromFields.map((f, i) => [field.relationToFields![i], row[f]]));
    } else {
      const reverse = target.fields.find(f => f.kind === "object" && f.type === model.name && f.relationName === field.relationName && f.relationFromFields?.length);
      if (!reverse) throw new Error("Unsupported implicit many-to-many relation");
      link = Object.fromEntries(reverse.relationFromFields!.map((f, i) => [f, row[reverse.relationToFields![i]]]));
    }
    const rows = await this.rows(target, { ...args, where: { AND: [link, args.where ?? {}] } });
    const projected = await Promise.all(rows.map(r => this.project(target, r, args)));
    return field.isList ? projected : projected[0] ?? null;
  }
  async project(model: Model, row: Row, args: Args): Promise<Row> {
    const out: Row = args.select ? {} : Object.fromEntries(model.fields.filter(f => f.kind !== "object").map(f => [f.name, row[f.name] === Prisma.DbNull || row[f.name] === Prisma.JsonNull ? null : row[f.name]]));
    for (const [name, selection] of Object.entries(args.select ?? args.include ?? {})) {
      if (!selection) continue;
      if (name === "_count") {
        const wanted = object(selection) && object(selection.select) ? Object.keys(selection.select) : model.fields.filter(f => f.kind === "object" && f.isList).map(f => f.name);
        const counts: Row = {};
        for (const field of wanted) { const related = await this.relation(model, row, field, {}); counts[field] = Array.isArray(related) ? related.length : related ? 1 : 0; }
        out[name] = counts;
      } else if (model.fields.some(f => f.name === name && f.kind === "object")) out[name] = await this.relation(model, row, name, object(selection) ? selection as Args : {});
      else out[name] = row[name] === Prisma.DbNull || row[name] === Prisma.JsonNull ? null : row[name];
    }
    return out;
  }
  async call(model: Model, operation: string, args: Args): Promise<unknown> {
    if (operation === "createMany" || operation === "createManyAndReturn") {
      if ("skipDuplicates" in args && args.skipDuplicates) throw new Error("skipDuplicates is unsupported by D1 plans");
      const input = Array.isArray(args.data) ? args.data : [args.data];
      const rows = [];
      for (const data of input) {
        if (!object(data)) throw new Error("Invalid createMany input");
        rows.push(await this.call(model, "create", { ...args, data }));
      }
      return operation === "createManyAndReturn" ? rows : { count: rows.length };
    }
    if (["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count"].includes(operation)) {
      const rows = await this.rows(model, { ...args, ...(!["findMany", "count"].includes(operation) ? { take: 1 } : {}) });
      if (operation === "count") return rows.length;
      if (operation === "findMany") return Promise.all(rows.map(r => this.project(model, r, args)));
      if (!rows[0]) return operation.endsWith("OrThrow") ? missing() : null;
      return this.project(model, rows[0], args);
    }
    if (operation === "upsert") {
      const rows = await this.rows(model, { where: args.where, take: 1 });
      return this.call(model, rows.length ? "update" : "create", { ...args, data: rows.length ? args.update : args.create });
    }
    if (operation === "create") {
      const data = { ...(args.data ?? {}) };
      const nested = Object.fromEntries(model.fields.filter(f => f.kind === "object" && data[f.name] !== undefined).map(f => [f.name, data[f.name]]));
      for (const name of Object.keys(nested)) delete data[name];
      for (const [name, input] of Object.entries(nested)) {
        const field = model.fields.find(f => f.name === name)!;
        if (!field.relationFromFields.length) continue;
        if (!object(input)) throw new Error("Invalid nested D1 relation");
        const target = models.get(field.type)!;
        let related: Row | null;
        if (object(input.create)) related = await this.call(target, "create", { data: input.create }) as Row;
        else if (object(input.connect)) related = await this.call(target, "findUniqueOrThrow", { where: input.connect }) as Row;
        else throw new Error("Unsupported nested D1 relation write");
        for (let i = 0; i < field.relationFromFields.length; i++) data[field.relationFromFields[i]] = related[field.relationToFields[i]];
      }
      const row = scalarData(model, data);
      this.plan.insert(model.name, row);
      this.changes(model).set(key(model, row), { row, deleted: false });
      for (const [name, input] of Object.entries(nested)) {
        const field = model.fields.find(f => f.name === name)!;
        if (field.relationFromFields.length) continue;
        if (!object(input) || Object.keys(input).some(k => k !== "create")) throw new Error("Unsupported nested D1 relation write");
        const target = models.get(field.type)!;
        const reverse = target.fields.find(f => f.kind === "object" && f.type === model.name && f.relationName === field.relationName && f.relationFromFields.length);
        if (!reverse) throw new Error("Unsupported nested D1 relation");
        const children = Array.isArray(input.create) ? input.create : [input.create];
        for (const child of children) {
          if (!object(child)) throw new Error("Invalid nested create");
          const link = Object.fromEntries(reverse.relationFromFields.map((f, i) => [f, row[reverse.relationToFields[i]]]));
          await this.call(target, "create", { data: { ...child, ...link } });
        }
      }
      return this.project(model, row, args);
    }
    if (["update", "updateMany", "delete", "deleteMany"].includes(operation)) {
      const many = operation.endsWith("Many");
      const rows = await this.rows(model, { where: args.where, ...(!many ? { take: 1 } : {}) });
      if (!many && !rows.length) missing();
      for (const previous of rows) {
        if (operation.startsWith("delete")) {
          const pk = model.primaryKey?.fields ?? model.fields.filter(f => f.isId).map(f => f.name);
          this.plan.deleteWhere(model.name, Object.fromEntries(pk.map(f => [f, String(previous[f])])));
          this.changes(model).set(key(model, previous), { row: previous, deleted: true });
        } else {
          if (!Object.values(args.data ?? {}).some(v => v !== undefined)) continue;
          const changes = scalarData(model, args.data ?? {}, previous);
          const row = { ...previous, ...changes };
          const pk = model.fields.find(f => f.isId)?.name;
          if (!pk) throw new Error("Composite-key update is not supported by D1 plans");
          this.plan.update(model.name, String(previous[pk]), changes);
          this.changes(model).set(key(model, previous), { row, deleted: false });
        }
      }
      if (many) return { count: rows.length };
      const changed = this.changes(model).get(key(model, rows[0]));
      return this.project(model, changed?.row ?? rows[0], args);
    }
    throw new Error(`D1 transaction operation is not implemented: ${model.name}.${operation}`);
  }
  proxy(): Prisma.TransactionClient {
    return new Proxy({}, { get: (_, property) => {
      if (property === "$executeRaw") return async (strings: TemplateStringsArray) => {
        // The guarded database revision serializes these writes, replacing Postgres advisory locks.
        if (Array.isArray(strings) && strings.join("").trim().startsWith("SELECT pg_advisory_xact_lock(")) return 0;
        throw new Error("Unconverted raw D1 transaction write refused");
      };
      const name = [...models.keys()].find(m => delegate(m) === property);
      if (!name) throw new Error("Unsupported D1 transaction member");
      return new Proxy({}, { get: (_t, operation) => (args: Args) => this.call(models.get(name)!, String(operation), args) });
    } }) as Prisma.TransactionClient;
  }
}

export function d1Transaction<T>(db: PrismaClient, callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return d1Atomic(plan => callback(new Transaction(db, plan).proxy()));
}
