import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { assertBusinessAccess } from "@/lib/business-access";
import { created, fail, handleError } from "@/lib/api";
import { allowShared } from "@/lib/rate-limit";
import {
  storeBusinessImage,
  StorageNotConfiguredError,
  deleteObject,
} from "@/lib/storage";
import {
  InvalidBusinessImage,
  MAX_IMAGE_BYTES,
  optimizeBusinessImage,
} from "@/features/business-images/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("media.write");
    if (
      !(await allowShared(
        "FORM_LIMITER",
        `business-image:${user.id}`,
        10,
        60_000,
      ))
    )
      return fail(429, "rate_limited", "Please retry shortly.");
    if (!request.headers.get("content-type")?.startsWith("image/"))
      return fail(415, "image_type", "Send a normalized PNG or JPEG image.");
    const businessId = new URL(request.url).searchParams.get("businessId");
    if (businessId) {
      if (businessId.length > 64)
        return fail(422, "invalid_business", "Invalid business.");
      await assertBusinessAccess(user, businessId);
      if (
        !(await prisma.business.findFirst({
          where: { id: businessId, deletedAt: null },
          select: { id: true },
        }))
      )
        return fail(404, "not_found", "Business not found.");
    }
    const reader = request.body?.getReader();
    if (!reader) return fail(422, "image_invalid", "Choose an image.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return fail(413, "image_size", "Image is too large.");
      }
      chunks.push(value);
    }
    const image = optimizeBusinessImage(
      Buffer.concat(chunks),
      request.headers.get("content-type")!.split(";")[0],
    );
    const key = `business-images/${user.id}/${crypto.randomUUID()}.${image.extension}`;
    const url = await storeBusinessImage(key, image.bytes, image.mimeType);
    try {
      const asset = await prisma.media.create({
        data: {
          storageKey: key,
          url,
          mimeType: image.mimeType,
          kind: "image",
          sizeBytes: image.bytes.length,
          width: image.width,
          height: image.height,
          uploadedById: user.id,
          businessId,
        },
      });
      return created({
        assetId: asset.id,
        publicUrl: url,
        width: image.width,
        height: image.height,
      });
    } catch (error) {
      await deleteObject(key).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof InvalidBusinessImage)
      return fail(
        422,
        "image_invalid",
        "The image could not be decoded safely. Replace it with a PNG or JPEG.",
      );
    if (error instanceof StorageNotConfiguredError)
      return fail(
        503,
        "storage_not_configured",
        "Media storage is not configured.",
      );
    return handleError(error, "media.business_image");
  }
}
