/** D1 atomic batches with optimistic validation, including writes made outside a plan. */
import { d1Connection, type D1Value } from "./d1-connection";
import { Prisma } from "@prisma/client";
import { D1_FOLDS, foldedData } from "./d1-fold";
import { d1Models as models } from "./d1-models";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
export const newId = () => crypto.randomUUID();

export class D1Plan {
  readonly statements: { sql: string; args: D1Value[] }[] = [];
  sql(sql: string, args: D1Value[] = []): void { this.statements.push({ sql, args }); }
  private values(table: string, data: Record<string, unknown>) {
    const model = models.get(table);
    if (!model) throw new Error("Unknown D1 model");
    return Object.entries(foldedData(table, data)).filter(([, v]) => v !== undefined).map(([name, v]) => {
      const field = model.fields.find(f => f.name === name && f.kind !== "object") ?? (Object.values(D1_FOLDS[table] ?? {}).includes(name) ? { type: "String", isList: false } : undefined);
      if (!field) throw new Error(`Unknown D1 scalar ${table}.${name}`);
      if (field.isList && (!Array.isArray(v) || v.some(item => typeof item !== "string"))) throw new Error(`Invalid D1 string array ${table}.${name}`);
      if (field.type === "Int" && v != null && (!Number.isInteger(v) || Number(v) < -2147483648 || Number(v) > 2147483647)) throw new Error(`D1 integer outside PostgreSQL Int range ${table}.${name}`);
      if (field.type === "Float" && v != null && (typeof v !== "number" || !Number.isFinite(v))) throw new Error(`Invalid D1 float ${table}.${name}`);
      let value: D1Value;
      if (v === null || v === Prisma.DbNull) value = null;
      else if (v === Prisma.JsonNull) value = "null";
      else if (v instanceof Date) { if (!Number.isFinite(v.getTime())) throw new Error("Invalid D1 date"); value = v.getTime(); }
      else if (typeof v === "boolean") value = v ? 1 : 0;
      else if (field.isList || field.type === "Json") value = JSON.stringify(v);
      else if (field.type === "Decimal") value = new Prisma.Decimal(v as string | number).toDecimalPlaces(2).toString();
      else if (typeof v === "string" || typeof v === "number") value = v;
      else throw new Error(`Invalid D1 scalar ${table}.${name}`);
      return { name, value };
    });
  }
  insert(table: string, data: Record<string, unknown>): string {
    const model = models.get(table);
    if (!model) throw new Error("Unknown D1 model");
    const id = typeof data.id === "string" ? data.id : newId();
    const now = new Date();
    const row = { ...(model.fields.some(f => f.name === "id") ? { id } : {}),
      ...(model.fields.some(f => f.name === "createdAt") ? { createdAt: now } : {}),
      ...(model.fields.some(f => f.name === "updatedAt") ? { updatedAt: now } : {}), ...data };
    const values = this.values(table, row);
    this.sql(`INSERT INTO ${quote(table)} (${values.map(v => quote(v.name)).join(",")}) VALUES (${values.map(() => "?").join(",")})`, values.map(v => v.value));
    return id;
  }
  update(table: string, id: string, data: Record<string, unknown>): void {
    const model = models.get(table);
    const values = this.values(table, { ...data, ...(model?.fields.some(f => f.name === "updatedAt") ? { updatedAt: data.updatedAt ?? new Date() } : {}) });
    if (!values.length) return;
    const key = model?.fields.find(f => f.isId)?.name;
    if (!key) throw new Error("D1 update requires a single primary key");
    this.sql(`UPDATE ${quote(table)} SET ${values.map(v => `${quote(v.name)}=?`).join(",")} WHERE ${quote(key)}=?`, [...values.map(v => v.value), id]);
  }
  deleteWhere(table: string, where: Record<string, string>): void {
    if (!models.has(table) || Object.keys(where).some(k => !models.get(table)?.fields.some(f => f.name === k))) throw new Error("Unknown D1 delete field");
    if (!Object.keys(where).length) throw new Error("Unbounded D1 delete refused");
    this.sql(`DELETE FROM ${quote(table)} WHERE ${Object.keys(where).map(k => `${quote(k)}=?`).join(" AND ")}`, Object.values(where));
  }
}

export async function d1Atomic<T>(prepare: (plan: D1Plan) => Promise<T>): Promise<T> {
  const db = d1Connection();
  for (let attempt = 0; attempt < 4; attempt++) {
    const { results } = await db.prepare('SELECT revision FROM "_RegaRevision" WHERE id=1').all<{ revision: number }>();
    if (results.length !== 1) throw new Error("D1 revision migration has not been applied");
    const revision = results[0].revision;
    const plan = new D1Plan();
    const result = await prepare(plan);
    if (plan.statements.length > 1000) throw new Error("D1 transaction exceeds the supported atomic batch size");
    const guard = db.prepare('UPDATE "_RegaRevision" SET revision=CASE WHEN revision=? THEN revision ELSE -1 END WHERE id=1').bind(revision);
    try {
      await db.batch([guard, ...plan.statements.map(s => db.prepare(s.sql).bind(...s.args))]);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes("RegaRevision_nonnegative")) {
        if (attempt < 3) continue;
        throw new Prisma.PrismaClientKnownRequestError("Concurrent write; retry the request", { code: "P2034", clientVersion: Prisma.prismaVersion.client });
      }
      if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: Prisma.prismaVersion.client });
      if (error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message)) throw new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", { code: "P2003", clientVersion: Prisma.prismaVersion.client });
      throw error;
    }
  }
  throw new Error("D1 concurrent write retry exhausted");
}
