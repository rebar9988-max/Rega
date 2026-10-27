/** Unicode case mirrors replace PostgreSQL's ILIKE semantics on SQLite's ASCII-only LIKE. */
import { Prisma } from "@prisma/client";
import fields from "./d1-fold-fields.json";
import { d1Models as models } from "./d1-models";
export const D1_FOLDS: Record<string, Record<string, string>> = fields;
type Record_ = Record<string, unknown>;
function record(value: unknown): value is Record_ { return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date); }
function lower(value: unknown): unknown {
  if (typeof value === "string") return value.toLowerCase();
  if (Array.isArray(value)) return value.map(lower);
  if (record(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, lower(v)]));
  return value;
}
export function foldedData(model: string, value: Record_): Record_ {
  const out = { ...value };
  for (const [name, folded] of Object.entries(D1_FOLDS[model] ?? {})) {
    if (name in value) out[folded] = lower(value[name]);
  }
  for (const field of models.get(model)?.fields ?? []) {
    if (field.kind !== "object" || !record(out[field.name])) continue;
    const nested = { ...(out[field.name] as Record_) };
    for (const key of ["create", "update", "upsert", "connectOrCreate", "createMany", "updateMany"]) {
      if (nested[key] !== undefined) nested[key] = mapDataOperation(field.type, nested[key]);
    }
    out[field.name] = nested;
  }
  for (const key of ["priceFrom", "priceTo", "discountValue"]) {
    const v = out[key];
    if (typeof v === "number" || typeof v === "string" || v instanceof Prisma.Decimal) out[key] = new Prisma.Decimal(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }
  return out;
}
function mapDataOperation(model: string, value: unknown): unknown {
  if (Array.isArray(value)) return value.map(v => mapDataOperation(model, v));
  if (!record(value)) return value;
  if ("data" in value || "create" in value || "update" in value) {
    const out = { ...value };
    for (const key of ["data", "create", "update"]) if (out[key] !== undefined) out[key] = mapDataOperation(model, out[key]);
    if (out.where) out.where = foldedWhere(model, out.where);
    return out;
  }
  return foldedData(model, value);
}
export function foldedWhere(model: string, value: unknown): unknown {
  if (Array.isArray(value)) return value.map(v => foldedWhere(model, v));
  if (!record(value)) return value;
  const out: Record_ = {};
  for (const [key, v] of Object.entries(value)) {
    if (["AND", "OR", "NOT", "some", "none", "every", "is", "isNot"].includes(key)) { out[key] = foldedWhere(model, v); continue; }
    const field = models.get(model)?.fields.find(f => f.name === key);
    if (field?.kind === "object") { out[key] = foldedWhere(field.type, v); continue; }
    if (field?.type === "Json" && record(v) && Array.isArray(v.path)) {
      out[key] = { ...v, path: "$" + v.path.map(part => "." + JSON.stringify(String(part))).join("") };
      continue;
    }
    if (record(v) && v.mode === "insensitive") {
      const folded = D1_FOLDS[model]?.[key];
      if (!folded) throw new Error(`Unmapped D1 case-insensitive field ${model}.${key}`);
      const { mode: _, ...filter } = v; void _;
      out[folded] = lower(filter);
    } else out[key] = v;
  }
  return out;
}
export function d1Arguments(model: string, value: unknown): unknown {
  if (!record(value)) return value;
  const out = { ...value };
  if (out.where) out.where = foldedWhere(model, out.where);
  for (const key of ["data", "create", "update"]) if (out[key] !== undefined) out[key] = mapDataOperation(model, out[key]);
  return out;
}
