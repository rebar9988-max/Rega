import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../src/lib/import/csv";

test("csv: header, rows, quotes, doubled quotes and line breaks inside quotes", () => {
  const r = parseCsv('name,city,description\n"Cafe ""Zagros""",Berlin,"Line 1\nLine 2, with comma"\nBar,Köln,\n');
  assert.deepEqual(r.header, ["name", "city", "description"]);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].name, 'Cafe "Zagros"');
  assert.equal(r.rows[0].description, "Line 1\nLine 2, with comma");
  assert.equal(r.rows[1].description, "");
});

test("csv: semicolon delimiter, BOM, CRLF and blank lines", () => {
  const r = parseCsv("﻿name;city\r\nA;Berlin\r\n\r\nB;Bonn\r\n");
  assert.equal(r.delimiter, ";");
  assert.deepEqual(r.rows, [{ name: "A", city: "Berlin" }, { name: "B", city: "Bonn" }]);
});

test("csv: headers only gives no rows; empty input gives nothing", () => {
  assert.deepEqual(parseCsv("name,city\n").rows, []);
  assert.deepEqual(parseCsv("").header, []);
});

test("csv: short rows are padded, long fields are kept verbatim", () => {
  const r = parseCsv("a,b,c\n1,2\n");
  assert.deepEqual(r.rows[0], { a: "1", b: "2", c: "" });
});
