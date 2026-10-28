// Typed, loss-checked values for a staged SQLite rehearsal; never executes SQL.
import { createHash } from "node:crypto";

const scalarTypes = new Set(["String", "DateTime", "Int", "Float", "Decimal", "Boolean", "Json", "Role"]);
export function modelsFromSchema(source) {
  return [...source.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)].map(([, name, body]) => {
    const fields = [...body.matchAll(/^\s+(\w+)\s+(\w+)(\[\]|\?)?([^\n]*)/gm)]
      .filter(([, , type]) => scalarTypes.has(type))
      .map(([, name, type, suffix, attrs]) => ({ name, type, array: suffix === "[]", nullable: suffix === "?", day: attrs.includes("@db.Date"), id: /\s@id\b/.test(attrs) }));
    const composite = body.match(/@@id\(\[([^\]]+)\]/);
    const primary = composite ? composite[1].split(",").map(s => s.trim()) : fields.filter(f => f.id).map(f => f.name);
    if (!primary.length || primary.some(p => !fields.some(f => f.name === p))) throw new Error(`Missing primary key: ${name}`);
    return { name, fields, primary };
  });
}

export function decimal(value) {
  const match = String(value).match(/^(-?)(\d{1,10})(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Decimal exceeds the source Decimal(12,2) contract");
  const whole = match[2].replace(/^0+(?=\d)/, "");
  const fraction = (match[3] || "").padEnd(2, "0");
  const sign = whole === "0" && fraction === "00" ? "" : match[1];
  return `${sign}${whole}.${fraction}`;
}

export function convert(field, value) {
  if (value === null) {
    if (!field.nullable) throw new Error(`Required source value is NULL: ${field.name}`);
    return null;
  }
  if (field.array) {
    if (!Array.isArray(value) || value.some(v => typeof v !== "string")) throw new Error(`Invalid string array: ${field.name}`);
    return JSON.stringify(value);
  }
  switch (field.type) {
    case "String": case "Role":
      if (typeof value !== "string" || value.includes("\0")) throw new Error(`Invalid text: ${field.name}`);
      return value;
    case "Json":
      // Export SELECT casts JSON to text, preserving SQL NULL versus JSON null.
      if (typeof value !== "string") throw new Error(`Expected raw JSON text: ${field.name}`);
      JSON.parse(value);
      return value;
    case "DateTime": {
      const date = value instanceof Date ? value : new Date(field.day ? `${value}T00:00:00.000Z` : value);
      if (!Number.isFinite(date.getTime())) throw new Error(`Invalid UTC date: ${field.name}`);
      return date.getTime();
    }
    case "Boolean":
      if (typeof value !== "boolean") throw new Error(`Invalid boolean: ${field.name}`);
      return value ? 1 : 0;
    case "Decimal": return decimal(value);
    case "Int":
      if (!Number.isSafeInteger(value)) throw new Error(`Invalid integer: ${field.name}`);
      return value;
    case "Float":
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid float: ${field.name}`);
      return Object.is(value, -0) ? 0 : value;
    default: throw new Error(`Unmapped type: ${field.type}`);
  }
}

export function sqlLiteral(value) {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite SQL number");
    return String(value);
  }
  if (typeof value !== "string" || value.includes("\0")) throw new Error("Invalid SQL text");
  return `'${value.replaceAll("'", "''")}'`;
}

export function hashRow(fields, values) {
  const cells = values.map((value, i) => {
    if (value === null) return "null";
    const field = fields[i];
    if (field.type === "Float") {
      const buffer = Buffer.alloc(8);
      buffer.writeDoubleBE(value === 0 ? 0 : value);
      return `f:${buffer.toString("hex")}`;
    }
    if (field.type === "Decimal") return `d:${decimal(value)}`;
    return `${typeof value === "number" ? "i" : "s"}:${value}`;
  });
  return createHash("sha256").update(JSON.stringify(cells)).digest("hex");
}

export const hashTable = hashes => createHash("sha256").update(hashes.sort().join("\n")).digest("hex");
