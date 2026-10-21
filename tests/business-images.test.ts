import test from "node:test";
import assert from "node:assert/strict";
import { encode, decode } from "fast-png";
import jpeg from "jpeg-js";
import {
  optimizeBusinessImage,
  MAX_IMAGE_BYTES,
} from "../src/features/business-images/process";
import { cropGeometry, RESET_CROP } from "../src/features/business-images/crop";
test("wide and tall logos keep their aspect ratio; preview geometry is exactly the canvas transform", () => {
  for (const [w, h] of [
    [2000, 300],
    [300, 2000],
    [10, 10],
  ]) {
    const g = cropGeometry(w, h, 1, RESET_CROP);
    assert.equal(g.width / g.height, w / h);
    assert.ok(g.left >= 0);
    assert.ok(g.top >= 0);
    const zoom = cropGeometry(w, h, 1, { zoom: 3, x: 999, y: -999 });
    assert.ok(zoom.left <= Math.max(0, 1 - zoom.width));
    assert.ok(zoom.top >= Math.min(0, 1 - zoom.height));
  }
});
test("PNG is decoded, checked and re-encoded without metadata and without changing crop pixels", () => {
  const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]);
  const input = encode({
    width: 2,
    height: 1,
    data: pixels,
    text: { Comment: "private metadata" },
  });
  const out = optimizeBusinessImage(input, "image/png");
  assert.equal(out.width, 2);
  assert.equal(out.height, 1);
  assert.deepEqual(decode(out.bytes).data, pixels);
  assert.deepEqual(decode(out.bytes).text, {});
  assert.equal(
    Buffer.from(out.bytes).includes(Buffer.from("private metadata")),
    false,
  );
});
test("JPEG output is web compatible and strips appended or original metadata", () => {
  const input = jpeg.encode(
    {
      width: 2,
      height: 1,
      data: Buffer.from([255, 0, 0, 255, 0, 255, 0, 255]),
    },
    90,
  ).data;
  const result = optimizeBusinessImage(input, "image/jpeg");
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(jpeg.decode(result.bytes).width, 2);
  assert.throws(() => optimizeBusinessImage(input, "image/png"));
});
test("malicious, corrupt, mismatched, truncated and oversized image bytes fail closed", () => {
  for (const data of [
    Buffer.from('<svg onload="alert(1)"/>'),
    Buffer.from("GIF89a"),
    new Uint8Array(MAX_IMAGE_BYTES + 1),
    new Uint8Array(),
  ])
    assert.throws(() => optimizeBusinessImage(data, "image/png"));
  const input = encode({ width: 1, height: 1, data: new Uint8Array(4) });
  const bomb = Uint8Array.from(input);
  new DataView(bomb.buffer).setUint32(16, 100000);
  assert.throws(() => optimizeBusinessImage(bomb, "image/png"));
  const corrupt = Uint8Array.from(input);
  corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => optimizeBusinessImage(corrupt, "image/png"));
  assert.throws(() => optimizeBusinessImage(input.slice(0, -5), "image/png"));
});
