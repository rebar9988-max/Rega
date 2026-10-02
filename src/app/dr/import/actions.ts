"use server";

import { requirePermission } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { IMPORT_MAX_BYTES, importBusinessesCsv, type ImportSummary } from "@/lib/import/businesses";

export type ImportState = ImportSummary | undefined;

/** CSV upload: validate (dry run) or create pending listings. Business owners can import; all listings start as pending and require moderation. */
export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requirePermission("business.write");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no_file" };
  if (file.size > IMPORT_MAX_BYTES) return { ok: false, error: "too_large" };
  const dryRun = formData.get("dryRun") === "1";
  const summary = await importBusinessesCsv(await file.text(), user, dryRun);
  if (summary.ok && !dryRun) {
    await writeAudit({ actorId: user.id, actorEmail: user.email, action: "business.import", entity: "Business", after: { created: summary.created, skipped: summary.skipped, errors: summary.errors } });
  }
  return summary;
}
