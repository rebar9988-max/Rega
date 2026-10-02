/**
 * POST /api/v1/media/upload-url — issues a pre-signed upload URL and registers the asset.
 * The client uploads straight to object storage; AWS/GCS/R2 credentials never reach the browser.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { created, fail, handleError } from "@/lib/api";
import { requirePermission } from "@/lib/auth-helpers";
import { mediaUploadRequestSchema } from "@/lib/validation";
import { buildObjectKey, createUploadUrl, publicUrlFor, StorageNotConfiguredError } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("media.write");
    const payload = mediaUploadRequestSchema.parse(await request.json());

    const key = buildObjectKey(payload);
    const { uploadUrl, expiresIn } = await createUploadUrl({ key, mimeType: payload.mimeType, sizeBytes: payload.sizeBytes });

    const asset = await prisma.media.create({
      data: {
        storageKey: key,
        url: publicUrlFor(key),
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        kind: payload.mimeType.startsWith("image/") ? "image" : payload.mimeType.startsWith("video/") ? "video" : "document",
        businessId: payload.businessId ?? null,
        serviceId: payload.serviceId ?? null,
        uploadedById: user.id,
      },
    });

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "media.upload_url",
      entity: "Media",
      entityId: asset.id,
      after: { key, mimeType: payload.mimeType, sizeBytes: payload.sizeBytes },
    });

    return created({ assetId: asset.id, uploadUrl, expiresIn, publicUrl: asset.url, method: "PUT" });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return fail(503, "storage_not_configured", "Media storage is not configured on this server.");
    }
    return handleError(error, "media.upload_url");
  }
}
