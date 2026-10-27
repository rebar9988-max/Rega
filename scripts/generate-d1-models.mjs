// Prisma's client-engine DMMF omits defaults, cardinality and FK columns; retain them explicitly for D1 plans.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

const source = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const models = [...source.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)].map(([, name, body]) => {
  const dmmf = Prisma.dmmf.datamodel.models.find(m => m.name === name);
  if (!dmmf) throw new Error("Generate the primary Prisma client before D1 metadata");
  const fields = [...body.matchAll(/^\s+(\w+)\s+(\w+)(\[\]|\?)?([^\n]*)/gm)].map(([, name, type, suffix, attrs]) => {
    const field = dmmf.fields.find(f => f.name === name);
    if (!field || field.type !== type) throw new Error("Primary client and source schema differ");
    const match = attrs.match(/@default\(("(?:[^"\\]|\\.)*"|\[\]|-?[\d.]+|true|false|\w+\([^)]*\)|\w+)\)/);
    let value;
    if (match) {
      const raw = match[1];
      if (/^\w+\(/.test(raw)) value = { name: raw.slice(0, raw.indexOf("(")), args: [] };
      else { try { value = JSON.parse(raw); } catch { value = raw; } }
    }
    const list = pattern => { const m = attrs.match(pattern); return m ? m[1].split(",").map(s => s.trim()) : []; };
    return { name, type, kind: field.kind, isList: suffix === "[]", isRequired: suffix !== "?", isId: /@id\b/.test(attrs),
      isUpdatedAt: /@updatedAt\b/.test(attrs), hasDefaultValue: Boolean(match), ...(match ? { default: value } : {}),
      ...(field.relationName ? { relationName: field.relationName } : {}),
      relationFromFields: list(/fields:\s*\[([^\]]+)\]/), relationToFields: list(/references:\s*\[([^\]]+)\]/) };
  });
  if (fields.length !== dmmf.fields.length) throw new Error("Incomplete D1 metadata");
  const pk = body.match(/@@id\(\[([^\]]+)\]/);
  return { name, fields, primaryKey: pk ? { fields: pk[1].split(",").map(s => s.trim()) } : null };
});
const output = JSON.stringify({ schemaSha256: createHash("sha256").update(source).digest("hex"), models }, null, 2) + "\n";
const target = new URL("../src/lib/d1-models.json", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output) throw new Error("D1 metadata is stale");
} else writeFileSync(target, output);
console.log("D1 model metadata verified");
