/** Prisma's two generated clients have distinct null-sentinel class identities. */
export function d1Null(value: unknown): "db" | "json" | "any" | undefined {
  if (value === null || typeof value !== "object") return;
  const prototype = Object.getPrototypeOf(value);
  if (!prototype || prototype === Object.prototype) return;
  const name = prototype.constructor?.name;
  if (!["DbNull", "JsonNull", "AnyNull"].includes(name)) return;
  if (String(value) !== `Prisma.${name}`) return;
  return name === "DbNull" ? "db" : name === "JsonNull" ? "json" : "any";
}
export type D1Nulls = { DbNull: unknown; JsonNull: unknown; AnyNull: unknown };
export function mapD1Nulls(value: unknown, nulls: D1Nulls): unknown {
  const kind = d1Null(value);
  if (kind) return nulls[kind === "db" ? "DbNull" : kind === "json" ? "JsonNull" : "AnyNull"];
  if (Array.isArray(value)) return value.map(v => mapD1Nulls(v, nulls));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapD1Nulls(v, nulls)]));
  return value;
}
