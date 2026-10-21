/** Pure JS codecs work in both Node and the existing Workers runtime; never serve source bytes. */
import jpeg from "jpeg-js";
import { decode as decodePng, encode as encodePng } from "fast-png";
import { inflateSync } from "node:zlib";

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 1_600_000;
export class InvalidBusinessImage extends Error {}

export function optimizeBusinessImage(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new InvalidBusinessImage("size");
  try {
    if (
      mime === "image/png" &&
      bytes.length > 33 &&
      Buffer.from(bytes.subarray(0, 8)).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      )
    ) {
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      const width = view.getUint32(16),
        height = view.getUint32(20);
      // The browser normalizes any supported source to an 8-bit, non-interlaced PNG/JPEG before upload.
      // Bound inflation before decoding, including malicious streams that lie about their dimensions.
      if (
        !width ||
        !height ||
        width * height > MAX_IMAGE_PIXELS ||
        bytes[24] !== 8 ||
        ![2, 6].includes(bytes[25]) ||
        bytes[28] !== 0
      )
        throw new Error("dimensions");
      const chunks: Uint8Array[] = [bytes.subarray(0, 8)],
        idat: Uint8Array[] = [];
      let offset = 8,
        ended = false,
        headerSeen = false;
      while (offset + 12 <= bytes.length) {
        const length = view.getUint32(offset);
        if (length > MAX_IMAGE_BYTES || offset + length + 12 > bytes.length)
          throw new Error("chunk");
        const type = Buffer.from(
          bytes.subarray(offset + 4, offset + 8),
        ).toString("ascii");
        if (type === "IHDR") {
          if (headerSeen || offset !== 8 || length !== 13)
            throw new Error("header");
          headerSeen = true;
        }
        if (["IHDR", "IDAT", "IEND"].includes(type))
          chunks.push(bytes.subarray(offset, offset + length + 12));
        else if (type[0] === type[0].toUpperCase())
          throw new Error("unsupported critical chunk");
        if (type === "IDAT")
          idat.push(bytes.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
        if (type === "IEND") {
          ended = true;
          break;
        }
      }
      if (!ended || !idat.length) throw new Error("incomplete");
      const expected = height * (width * (bytes[25] === 6 ? 4 : 3) + 1);
      const inflated = inflateSync(Buffer.concat(idat), {
        maxOutputLength: expected,
      });
      if (inflated.length !== expected) throw new Error("pixels");
      const decoded = decodePng(Buffer.concat(chunks), { checkCrc: true });
      const data = encodePng({
        width,
        height,
        data: decoded.data,
        channels: decoded.channels,
        depth: 8,
      });
      return {
        bytes: data,
        mimeType: "image/png",
        extension: "png",
        width,
        height,
      };
    }
    if (
      mime === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[bytes.length - 2] === 255 &&
      bytes[bytes.length - 1] === 217
    ) {
      const decoded = jpeg.decode(bytes, {
        useTArray: true,
        tolerantDecoding: false,
        maxResolutionInMP: MAX_IMAGE_PIXELS / 1e6,
        maxMemoryUsageInMB: 40,
      });
      if (decoded.width * decoded.height > MAX_IMAGE_PIXELS)
        throw new Error("dimensions");
      const encoded = jpeg.encode(
        { width: decoded.width, height: decoded.height, data: decoded.data },
        84,
      );
      return {
        bytes: new Uint8Array(encoded.data),
        mimeType: "image/jpeg",
        extension: "jpg",
        width: decoded.width,
        height: decoded.height,
      };
    }
  } catch {
    throw new InvalidBusinessImage("decode");
  }
  throw new InvalidBusinessImage("type");
}
