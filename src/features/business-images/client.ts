export const BUSINESS_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,.heic,.heif";
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export async function uploadBusinessImage(blob: Blob, businessId?: string) {
  const res = await fetch(
    `/api/v1/media/business-image${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`,
    {
      method: "POST",
      headers: { "content-type": blob.type },
      body: blob,
    },
  );
  const body = await res.json().catch(() => null);
  if (res.status === 503) throw new Error("notConfigured");
  if (!res.ok || !body?.ok) throw new Error("error");
  return body.data.publicUrl as string;
}
export async function imageFromFile(
  file: File,
): Promise<{ image: HTMLImageElement; url: string }> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error("tooLarge");
  if (
    !/^image\/(jpeg|png|webp|avif|gif|heic|heif)$/.test(file.type) &&
    !/\.(jpe?g|png|webp|avif|gif|hei[cf])$/i.test(file.name)
  )
    throw new Error("badType");
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("unsupported");
  }
  if (
    !image.naturalWidth ||
    image.naturalWidth * image.naturalHeight > 48_000_000
  ) {
    URL.revokeObjectURL(url);
    throw new Error("tooLarge");
  }
  return { image, url };
}
export function canvasBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("error"))),
      type,
      0.88,
    ),
  );
}
