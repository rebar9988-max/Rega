/** Storage object keys (pure: no credentials, safe to import anywhere). */
export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "application/pdf": "pdf",
};

/** Object key from the validated MIME type, never from the user-supplied filename (no "x.html"/"x.php" keys). */
export function buildObjectKey(params: { filename: string; mimeType?: string; businessId?: string; serviceId?: string }): string {
  const ext = EXT_BY_MIME[params.mimeType ?? ""] ?? "bin";
  const scope = params.businessId ? `businesses/${params.businessId}` : params.serviceId ? `services/${params.serviceId}` : "library";
  const stamp = new Date().toISOString().slice(0, 10);
  const id = crypto.randomUUID();
  return `${scope}/${stamp}/${id}.${ext}`;
}
