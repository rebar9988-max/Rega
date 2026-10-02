/**
 * Media storage — S3-compatible (Cloudflare R2, AWS S3, GCS interop, MinIO).
 * Credentials stay server-side; browsers only ever receive short-lived pre-signed URLs.
 */
import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv, isStorageConfigured } from "@/lib/env";
import { log } from "@/lib/logger";
import { UPLOAD_MIME_TYPES } from "@/lib/validation";

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;
  const env = serverEnv();
  client = new S3Client({
    region: env.STORAGE_REGION,
    ...(env.STORAGE_ENDPOINT ? { endpoint: env.STORAGE_ENDPOINT, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? "",
    },
  });
  return client;
}

// Same allow-list as the upload request schema (no SVG/HTML: stored XSS). One list, so a type the API accepts can
// never fail here with a 500.
const ALLOWED = new Set<string>(UPLOAD_MIME_TYPES);

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Media storage is not configured on the server.");
  }
}

/** Pre-signed PUT so the browser uploads directly to the bucket — no credentials in the client. */
export async function createUploadUrl(input: {
  key: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }> {
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
  if (!ALLOWED.has(input.mimeType)) throw new Error(`Unsupported media type: ${input.mimeType}`);

  const env = serverEnv();
  const expiresIn = 300;
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET!,
      Key: input.key,
      ContentType: input.mimeType,
    }),
    { expiresIn },
  );

  log.info("storage.upload_url.issued", { key: input.key, mimeType: input.mimeType, sizeBytes: input.sizeBytes });
  return { uploadUrl, publicUrl: publicUrlFor(input.key), expiresIn };
}

export function publicUrlFor(key: string): string {
  const env = serverEnv();
  return `${(env.MEDIA_PUBLIC_URL ?? "").replace(/\/$/, "")}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
  const env = serverEnv();
  await s3().send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET!, Key: key }));
  log.info("storage.object.deleted", { key });
}

/** Safe object key: never trust a client filename. */
export { buildObjectKey } from "@/lib/object-key";
