import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The owner-supplied REGA24 master; derivatives are resized from it by scripts/generate-rega24-logo-assets.py.
const MASTER = "docs/brand/rega24-official-logo-master.png";
const MASTER_SHA256 = "63a55a12a94b9df557ff1146f93914e60a315db7cc3d5521e36922ed1830a572";

function dimensions(file: string): [number, number] {
  const b = readFileSync(file);
  if (b.subarray(1, 4).toString() === "PNG") return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(12, 16).toString() === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1) {
    // ICO: one directory entry per embedded size (0 means 256).
    return [b[6] || 256, b[7] || 256];
  }
  throw new Error(`unknown image format: ${file}`);
}

// [file, width, height, byte budget]
const DERIVATIVES: [string, number, number, number][] = [
  ["public/brand/rega24-badge-64.webp", 64, 64, 4_000],
  ["public/brand/rega24-badge-96.webp", 96, 96, 6_000],
  ["public/brand/rega24-badge-192.webp", 192, 192, 15_000],
  ["public/brand/rega24-badge-384.webp", 384, 384, 40_000],
  ["public/brand/rega24-badge-512.png", 512, 512, 250_000],
  ["public/brand/rega24-maskable-192.png", 192, 192, 50_000],
  ["public/brand/rega24-maskable-512.png", 512, 512, 250_000],
  ["public/icon.png", 192, 192, 50_000],
  ["public/apple-icon.png", 180, 180, 50_000],
  ["public/favicon.ico", 16, 16, 15_000],
  ["public/opengraph-image.png", 1200, 630, 300_000],
];

test("REGA24 master is stored unmodified", () => {
  assert.equal(createHash("sha256").update(readFileSync(MASTER)).digest("hex"), MASTER_SHA256);
});

test("REGA24 derivatives: exact pixel sizes and file-size budgets", () => {
  for (const [file, w, h, budget] of DERIVATIVES) {
    assert.ok(existsSync(file), file);
    assert.deepEqual(dimensions(file), [w, h], file);
    assert.ok(statSync(file).size <= budget, `${file}: ${statSync(file).size} > ${budget} bytes`);
  }
  const ico = readFileSync("public/favicon.ico");
  const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16]);
  assert.deepEqual(sizes.sort((a, b) => a - b), [16, 32, 48]);
});

test("PWA manifest: 192/512 icons for any and maskable, all from the REGA24 set", () => {
  const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as { icons: { src: string; sizes: string; purpose?: string }[] };
  for (const purpose of ["any", "maskable"]) for (const size of ["192x192", "512x512"]) {
    assert.ok(m.icons.some((i) => i.sizes === size && (i.purpose ?? "any") === purpose), `${purpose} ${size}`);
  }
});

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
}

test("one shared logo component renders the badge, always with explicit width and height", () => {
  const files = sources("src");
  for (const f of files) {
    const code = readFileSync(f, "utf8");
    assert.ok(!/rega-(mark|wordmark|logo)[-.]/.test(code), `${f} uses a retired logo asset`);
    if (f.endsWith("components/ui/Logo.tsx")) continue;
    if (f.endsWith(".tsx")) assert.ok(!/rega24-badge-/.test(code), `${f} renders the badge without the shared Logo component`);
  }
  const users = files.filter((f) => /<(Logo|LogoMark)\b/.test(readFileSync(f, "utf8")) && !f.endsWith("components/ui/Logo.tsx"));
  assert.ok(users.length >= 6, users.join(", "));
  const logo = readFileSync("src/components/ui/Logo.tsx", "utf8");
  for (const img of logo.match(/<img\b[^>]*>/g) ?? []) assert.match(img, /width=\{\d+\} height=\{\d+\}/, img);
});
