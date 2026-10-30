/**
 * Area-average (box) downscale of 8-bit RGB/RGBA pixels, for making variants of images that were uploaded before
 * variants existed (scripts/backfill-image-variants.ts). New uploads are scaled in the browser. Pure.
 */
export function downscale(src: { width: number; height: number; data: ArrayLike<number>; channels: number }, width: number) {
  const { channels: c } = src;
  if (width >= src.width || width < 1) throw new Error("downscale only");
  const height = Math.max(1, Math.round((src.height * width) / src.width));
  const out = new Uint8Array(width * height * c);
  const sx = src.width / width;
  const sy = src.height / height;
  const acc = new Float64Array(c);
  for (let y = 0; y < height; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < width; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      acc.fill(0);
      let total = 0;
      for (let yy = Math.floor(y0); yy < Math.min(src.height, Math.ceil(y1)); yy++) {
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        for (let xx = Math.floor(x0); xx < Math.min(src.width, Math.ceil(x1)); xx++) {
          const wgt = wy * (Math.min(x1, xx + 1) - Math.max(x0, xx));
          const i = (yy * src.width + xx) * c;
          for (let k = 0; k < c; k++) acc[k] += src.data[i + k] * wgt;
          total += wgt;
        }
      }
      const o = (y * width + x) * c;
      for (let k = 0; k < c; k++) out[o + k] = Math.round(acc[k] / total);
    }
  }
  return { width, height, data: out, channels: c };
}
