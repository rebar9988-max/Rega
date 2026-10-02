import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { COLUMN_NAME_LOCALES as COLUMN_LOCALES, LOCALE_META, localeSuffix } from "@/config/locales";
import { saveCityAction } from "../../actions";

const input = "min-h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";

export default async function EditCity({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireDr("category.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations("geo");
  const city = await prisma.city.findUnique({ where: { id } });
  if (!city) notFound();
  const regions = await prisma.region.findMany({ where: { countryId: city.countryId }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true } });
  const row = city as unknown as Record<string, string | null>;

  return (
    <>
      <nav className="mb-2 text-sm"><Link href="/dr/geography" className="text-muted hover:text-ink">{t("title")}</Link></nav>
      <h1 className="mb-6 text-2xl font-extrabold">{t("editCity")}: <bdi>{city.nameEn}</bdi></h1>
      {sp.saved && <p role="status" className="mb-4 rounded-xl bg-[oklch(0.95_0.05_150)] px-4 py-3 text-sm font-semibold text-[oklch(0.35_0.1_150)]">{t("saved")}</p>}
      {sp.error && <p role="alert" className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t("errorSlug")}</p>}
      <form action={saveCityAction} className="max-w-3xl space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <input type="hidden" name="id" value={city.id} /><input type="hidden" name="countryId" value={city.countryId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("nameEn")}<input name="nameEn" required maxLength={120} dir="ltr" defaultValue={city.nameEn} className={input} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("slug")}<input name="slug" maxLength={80} dir="ltr" defaultValue={city.slug ?? ""} className={input} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("region")}<select name="regionId" defaultValue={city.regionId ?? ""} className={input}><option value="">—</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.nameEn}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("sortOrder")}<input name="sortOrder" type="number" min={0} defaultValue={city.sortOrder} dir="ltr" className={input} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("lat")}<input name="lat" inputMode="decimal" dir="ltr" defaultValue={city.latitude ?? ""} className={input} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{t("lng")}<input name="lng" inputMode="decimal" dir="ltr" defaultValue={city.longitude ?? ""} className={input} /></label>
        </div>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-bold">{t("translations")}</legend>
          {COLUMN_LOCALES.map((l) => (
            <label key={l} className="flex flex-col gap-1 text-sm font-semibold" lang={LOCALE_META[l].htmlLang}>{t("nameIn", { language: LOCALE_META[l].nativeName })}
              <input name={`name${localeSuffix(l)}`} dir={LOCALE_META[l].dir} maxLength={120} defaultValue={row[`name${localeSuffix(l)}`] ?? ""} className={input} /></label>
          ))}
        </fieldset>
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover">{t("save")}</button>
      </form>
    </>
  );
}
