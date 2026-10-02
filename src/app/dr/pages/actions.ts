"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { LOCALES, localeSuffix } from "@/config/locales";
import { PAGE_SLUG } from "@/lib/cms";

const schema = z.object({
  id: z.string().max(64).optional().transform((v) => v || undefined),
  slug: z.string().trim().toLowerCase().max(80).regex(PAGE_SLUG),
  status: z.enum(["draft", "published", "archived"]),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
});

/** Create / edit a CMS page with one title, body and meta description per language (rows in PageTranslation). */
export async function savePageAction(formData: FormData): Promise<void> {
  const user = await requirePermission("content.write");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dr/pages?error=invalid");
  const { id, slug, status, sortOrder } = parsed.data;
  const clash = await prisma.page.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) redirect(id ? `/dr/pages/${id}?error=slug` : "/dr/pages?error=slug");
  const page = id
    ? await prisma.page.update({ where: { id }, data: { slug, status, sortOrder } })
    : await prisma.page.create({ data: { slug, status, sortOrder } });
  for (const l of LOCALES) {
    const title = String(formData.get(`title${localeSuffix(l)}`) ?? "").trim().slice(0, 200);
    const body = String(formData.get(`body${localeSuffix(l)}`) ?? "").trim().slice(0, 50_000);
    const metaDescription = String(formData.get(`meta${localeSuffix(l)}`) ?? "").trim().slice(0, 300) || null;
    if (title && body) {
      await prisma.pageTranslation.upsert({ where: { pageId_locale: { pageId: page.id, locale: l } }, update: { title, body, metaDescription }, create: { pageId: page.id, locale: l, title, body, metaDescription } });
    } else {
      await prisma.pageTranslation.deleteMany({ where: { pageId: page.id, locale: l } });
    }
  }
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: id ? "page.update" : "page.create", entity: "Page", entityId: page.id, after: { slug, status } });
  revalidatePath("/", "layout");
  redirect(`/dr/pages/${page.id}?saved=1`);
}
