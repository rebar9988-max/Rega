import { getTranslations } from "next-intl/server";
import { requireDr } from "@/lib/dr-auth";
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS, IMPORT_REQUIRED } from "@/lib/import/businesses";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  await requireDr("business.publish");
  const t = await getTranslations("importer");
  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold">{t("title")}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">{t("intro", { max: IMPORT_MAX_ROWS })}</p>
      <section className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-2 text-sm font-bold">{t("columns")}</h2>
        <p dir="ltr" className="break-words text-xs text-muted"><b>{IMPORT_REQUIRED.join(", ")}</b>, {IMPORT_COLUMNS.filter((c) => !(IMPORT_REQUIRED as readonly string[]).includes(c)).join(", ")}</p>
        <a href="/import-sample.csv" download className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-brand underline">{t("sample")}</a>
      </section>
      <ImportForm />
    </>
  );
}
