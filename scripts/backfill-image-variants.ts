/**
 * One-off backfill: smaller copies (src/features/business-images/variants.ts) for business images uploaded before
 * copies existed. Additive and reversible:
 *   1. reads the business image URLs (Business.logoUrl, coverUrl, photos) from D1 — read-only;
 *   2. for each plain REGA business image: downloads the original, writes `<uuid>-w<width>.<ext>` copies to R2
 *      (never touches the original) and checks that each copy is publicly served with the uploaded bytes;
 *   3. only when every copy of an image is verified: points the stored URL at its copies (`…?v=…&w=…`), with an
 *      exact-match UPDATE, and reads the rows back.
 * Undo for one image: set the URL back to the part before "?" (the copies can stay; nothing links to them then).
 *
 * Usage (needs wrangler auth: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID):
 *   npx tsx scripts/backfill-image-variants.ts            # dry run: lists what would be done, writes nothing
 *   npx tsx scripts/backfill-image-variants.ts --apply    # writes copies, then updates URLs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jpeg from "jpeg-js";
import { decode as decodePng, encode as encodePng } from "fast-png";
import { downscale } from "../src/features/business-images/resize";
import { businessImageId, variantKey, variantWidthsFor, withVariants } from "../src/features/business-images/variants";

const APPLY = process.argv.includes("--apply");
const DB = "rega24-migration";
const BUCKET = process.env.STORAGE_BUCKET || "rega-media";
const MEDIA_HOST = "https://media.regaplatform.com/";

function wrangler(args: string[]) {
  return execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}
function d1(sql: string) {
  const out = JSON.parse(wrangler(["d1", "execute", DB, "--remote", "--json", "--command", sql]));
  return out[0].results as Record<string, unknown>[];
}
const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;

async function main() {
  const rows = d1("SELECT id, logoUrl, coverUrl, photos FROM Business WHERE deletedAt IS NULL") as {
    id: string; logoUrl: string | null; coverUrl: string | null; photos: string | null;
  }[];
  const urls = new Set<string>();
  for (const r of rows) {
    for (const u of [r.logoUrl, r.coverUrl, ...(JSON.parse(r.photos || "[]") as string[])])
      if (u && u.startsWith(MEDIA_HOST) && !u.includes("?") && businessImageId(u)) urls.add(u);
  }
  console.log(`${rows.length} businesses, ${urls.size} plain business images${APPLY ? "" : " (dry run)"}`);
  const dir = mkdtempSync(join(tmpdir(), "variants-"));
  const replaced = new Map<string, string>();
  for (const url of urls) {
    const id = businessImageId(url)!;
    const res = await fetch(url);
    if (!res.ok) { console.log(`skip ${url}: HTTP ${res.status}`); continue; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const img = id.ext === "png"
      ? (() => { const p = decodePng(bytes); return { width: p.width, height: p.height, data: p.data as Uint8Array, channels: p.channels }; })()
      : (() => { const j = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 2, maxMemoryUsageInMB: 64 }); return { width: j.width, height: j.height, data: j.data, channels: 4 }; })();
    if (img.data instanceof Uint16Array || img.channels < 3) { console.log(`skip ${url}: unsupported pixel format`); continue; }
    const widths = variantWidthsFor(img.width);
    let ok = widths.length > 0;
    for (const w of widths) {
      const small = downscale(img, w);
      const out = id.ext === "png"
        ? encodePng({ width: small.width, height: small.height, data: small.data, channels: small.channels, depth: 8 })
        : new Uint8Array(jpeg.encode({ width: small.width, height: small.height, data: small.data }, 84).data);
      const key = variantKey(id.uuid, w, id.ext);
      console.log(`${key}: ${small.width}x${small.height}, ${Math.round(out.length / 1024)} KB (original ${Math.round(bytes.length / 1024)} KB)`);
      if (!APPLY) continue;
      const file = join(dir, key.replaceAll("/", "_"));
      writeFileSync(file, out);
      wrangler(["r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--remote",
        "--content-type", id.ext === "png" ? "image/png" : "image/jpeg",
        "--cache-control", "public, max-age=31536000, immutable", "--content-disposition", "inline"]);
      const check = await fetch(`${MEDIA_HOST}${key}`, { cache: "no-store" });
      const served = check.ok ? (await check.arrayBuffer()).byteLength : -1;
      if (served !== out.length) { console.log(`  NOT verified (HTTP ${check.status}, ${served} bytes)`); ok = false; }
    }
    if (ok) replaced.set(url, withVariants(url, widths, img.width));
  }
  if (!APPLY) return console.log("dry run: nothing written");
  for (const [from, to] of replaced) {
    for (const col of ["logoUrl", "coverUrl"]) d1(`UPDATE Business SET ${col} = ${quote(to)} WHERE ${col} = ${quote(from)}`);
    d1(`UPDATE Business SET photos = REPLACE(photos, ${quote(JSON.stringify(from))}, ${quote(JSON.stringify(to))}) WHERE instr(photos, ${quote(JSON.stringify(from))}) > 0`);
  }
  console.log(`URLs pointed at their copies: ${replaced.size} of ${urls.size}`);
  console.log(JSON.stringify(d1("SELECT slug, logoUrl, coverUrl, photos FROM Business WHERE deletedAt IS NULL"), null, 1));
}

main().catch((error) => { console.error(error); process.exit(1); });
