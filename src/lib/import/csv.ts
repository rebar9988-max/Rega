/**
 * Minimal RFC 4180 CSV reader for the admin import (pure, no I/O): quoted fields, doubled quotes, line breaks inside
 * quotes, UTF-8 BOM, and a comma or semicolon delimiter (Excel in German locales writes semicolons).
 */
export type CsvResult = { header: string[]; rows: Record<string, string>[]; delimiter: "," | ";" };

export function parseCsv(input: string): CsvResult {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter: "," | ";" = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { record.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field); field = "";
      records.push(record); record = [];
    } else field += ch;
  }
  if (field !== "" || record.length > 0) { record.push(field); records.push(record); }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { header: [], rows: [], delimiter };
  const header = nonEmpty[0].map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { header, rows, delimiter };
}
