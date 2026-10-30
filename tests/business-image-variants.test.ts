import test from "node:test";
import assert from "node:assert/strict";
import { businessImageId, parseVariants, responsiveImage, variantKey, variantWidthsFor, withVariants } from "../src/features/business-images/variants";
import { ownsBusinessImages } from "../src/lib/business-media";

const ID = "0d426969-0054-489a-856e-40dadc43dd9c";
const BASE = `https://media.example.org/business-images/${ID}.jpg`;

test("variant widths, keys and the announced URL round-trip", () => {
  assert.deepEqual(variantWidthsFor(1280), [160, 480, 720, 960]);
  assert.deepEqual(variantWidthsFor(512), [160, 480].filter((w) => w < 512 * 0.9)); // 480 is within 10 % of 512
  assert.deepEqual(variantWidthsFor(150), []);
  assert.equal(variantKey(ID, 480, "jpg"), `business-images/${ID}-w480.jpg`);
  assert.deepEqual(businessImageId(BASE), { uuid: ID, ext: "jpg" });
  assert.deepEqual(businessImageId(`business-images/${ID}.png`), { uuid: ID, ext: "png" });
  assert.equal(businessImageId(`https://media.example.org/other/${ID}.jpg`), null);
  const url = withVariants(BASE, [160, 480, 720, 960], 1280);
  assert.equal(url, `${BASE}?v=160,480,720,960&w=1280`);
  assert.deepEqual(parseVariants(url), { base: BASE, uuid: ID, ext: "jpg", widths: [160, 480, 720, 960], width: 1280 });
  assert.equal(withVariants(BASE, [], 100), BASE);
});

test("srcset lists the copies and the original; plain or inconsistent URLs stay plain", () => {
  const dir = "https://media.example.org/business-images/";
  assert.deepEqual(responsiveImage(`${BASE}?v=160,480,720,960&w=1280`), {
    src: BASE,
    srcSet: `${dir}${ID}-w160.jpg 160w, ${dir}${ID}-w480.jpg 480w, ${dir}${ID}-w720.jpg 720w, ${dir}${ID}-w960.jpg 960w, ${BASE} 1280w`,
  });
  for (const url of [
    BASE, // older upload, no copies
    "https://example.com/photo.jpg", // external
    "not a url",
    `${BASE}?v=480,160&w=1280`, // not ascending
    `${BASE}?v=960&w=900`, // copy not smaller than the original
    `${BASE}?v=480&w=1280&x=1`, // unknown parameter
    `${BASE}?v=123&w=1280`, // not an allowed width
    `https://media.example.org/business-images/${ID}.gif?v=160&w=1280`, // not a business image format
  ]) assert.deepEqual(responsiveImage(url), { src: url }, url);
});

/** Minimal stand-in for the two Media queries ownsBusinessImages makes. */
function fakeDb(rows: { url: string; storageKey: string; width: number | null; uploadedById: string }[]) {
  return {
    media: {
      findMany: async ({ where }: { where: { url: { in: string[] }; uploadedById: string } }) =>
        rows.filter((r) => where.url.in.includes(r.url) && r.uploadedById === where.uploadedById && r.storageKey.startsWith("business-images/")),
      count: async ({ where }: { where: { storageKey: { in: string[] }; uploadedById: string } }) =>
        rows.filter((r) => where.storageKey.in.includes(r.storageKey) && r.uploadedById === where.uploadedById).length,
    },
  } as never;
}

test("a URL announcing copies is accepted only when the actor uploaded the original and every copy", async () => {
  const own = (key: string, url: string, width: number | null = null, uploadedById = "u1") => ({ storageKey: key, url, width, uploadedById });
  const rows = [
    own(`business-images/${ID}.jpg`, BASE, 1280),
    own(`business-images/${ID}-w160.jpg`, `${BASE}-160`),
    own(`business-images/${ID}-w480.jpg`, `${BASE}-480`),
  ];
  const db = fakeDb(rows);
  assert.equal(await ownsBusinessImages(db, [BASE], "u1"), true);
  assert.equal(await ownsBusinessImages(db, [`${BASE}?v=160,480&w=1280`], "u1"), true);
  assert.equal(await ownsBusinessImages(db, [`${BASE}?v=160,480,960&w=1280`], "u1"), false, "960 copy was never uploaded");
  assert.equal(await ownsBusinessImages(db, [`${BASE}?v=160,480&w=1100`], "u1"), false, "wrong original width");
  assert.equal(await ownsBusinessImages(db, [`${BASE}?v=160,480&w=1280`], "u2"), false, "someone else's image");
  assert.equal(await ownsBusinessImages(db, [`${BASE}?foo=1`], "u1"), false, "arbitrary query");
  // Unchanged URLs already on the listing are kept as they are.
  assert.equal(await ownsBusinessImages(db, [`${BASE}?v=160,480,960&w=1280`], "u2", [`${BASE}?v=160,480,960&w=1280`]), true);
});

test("backfill downscale averages pixel areas and keeps the aspect ratio", async () => {
  const { downscale } = await import("../src/features/business-images/resize");
  // 4x2 RGBA: left half black, right half white -> 2x1: one black, one white pixel.
  const data = new Uint8Array(4 * 2 * 4);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 4; x++) {
      data.fill(x < 2 ? 0 : 255, (y * 4 + x) * 4, (y * 4 + x) * 4 + 3);
      data[(y * 4 + x) * 4 + 3] = 255;
    }
  }
  const out = downscale({ width: 4, height: 2, data, channels: 4 }, 2);
  assert.deepEqual([out.width, out.height], [2, 1]);
  assert.deepEqual([...out.data], [0, 0, 0, 255, 255, 255, 255, 255]);
  // Non-integer ratio: 3 -> 2 mixes the middle column half and half.
  const grey = downscale({ width: 3, height: 1, data: new Uint8Array([0, 0, 0, 90, 90, 90, 180, 180, 180]), channels: 3 }, 2);
  assert.deepEqual([...grey.data], [30, 30, 30, 150, 150, 150]);
  assert.equal(downscale({ width: 1280, height: 720, data: new Uint8Array(1280 * 720 * 3), channels: 3 }, 480).height, 270);
  assert.throws(() => downscale({ width: 10, height: 10, data: new Uint8Array(300), channels: 3 }, 10));
});
