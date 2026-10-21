/** Normalized crop geometry. One transform drives both the preview and saved canvas. */
export type Crop = { zoom: number; x: number; y: number };
export const RESET_CROP: Crop = { zoom: 1, x: 0, y: 0 };
export function cropGeometry(
  width: number,
  height: number,
  aspect: number,
  crop: Crop,
) {
  const base = Math.min(1 / width, 1 / aspect / height); // contain: whole logo is visible on reset
  const scale = base * Math.max(1, Math.min(5, crop.zoom));
  const w = width * scale,
    h = height * scale;
  const x = Math.max(
    -Math.abs(1 - w) / 2,
    Math.min(Math.abs(1 - w) / 2, crop.x),
  );
  const y = Math.max(
    -Math.abs(1 / aspect - h) / 2,
    Math.min(Math.abs(1 / aspect - h) / 2, crop.y),
  );
  return {
    width: w,
    height: h,
    left: (1 - w) / 2 + x,
    top: (1 / aspect - h) / 2 + y,
  };
}
