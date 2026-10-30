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
import { variantKey, variantWidthsFor } from "@/features/business-images/variants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("media.write");
    const params = new URL(request.url).searchParams;
    // A smaller copy of an image this user uploaded before (see features/business-images/variants.ts): up to four per
    // image, so it has its own, wider window.
    const variantOf = params.get("variantOf");
    if (
      !(await allowShared(
        "FORM_LIMITER",
        variantOf ? `business-image-variant:${user.id}` : `business-image:${user.id}`,
        variantOf ? 40 : 10,
        60_000,
      ))
    )
      return fail(429, "rate_limited", "Please retry shortly.");
    if (!request.headers.get("content-type")?.startsWith("image/"))
      return fail(415, "image_type", "Send a normalized PNG or JPEG image.");
    let parent: { width: number; height: number; mimeType: string; businessId: string | null } | null = null;
    const variantWidth = Number(params.get("w"));
    if (variantOf !== null) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(variantOf))
        return fail(422, "invalid_variant", "Invalid image.");
      const row = await prisma.media.findFirst({
        where: { storageKey: { in: [`business-images/${variantOf}.jpg`, `business-images/${variantOf}.png`] },
          uploadedById: user.id, deletedAt: null, kind: "image" },
        select: { width: true, height: true, mimeType: true, businessId: true },
      });
      if (!row?.width || !row.height || !variantWidthsFor(row.width).includes(variantWidth))
        return fail(422, "invalid_variant", "Invalid image.");
      parent = { width: row.width, height: row.height, mimeType: row.mimeType, businessId: row.businessId };
    }
    const businessId = parent ? parent.businessId : params.get("businessId");
    if (businessId && !parent) {
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
    // A variant keeps the original's format and aspect ratio (rounding aside) at exactly the announced width.
    if (parent && (image.mimeType !== parent.mimeType || image.width !== variantWidth
      || Math.abs(image.height - Math.round((parent.height * variantWidth) / parent.width)) > 1))
      return fail(422, "invalid_variant", "Invalid image.");
    const key = parent ? variantKey(variantOf!, variantWidth, image.extension) : `business-images/${crypto.randomUUID()}.${image.extension}`;
    // A variant is written once: storing it again would replace bytes that published pages may already use.
    if (parent && (await prisma.media.findFirst({ where: { storageKey: key }, select: { id: true } })))
      return fail(409, "variant_exists", "This copy already exists.");
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
