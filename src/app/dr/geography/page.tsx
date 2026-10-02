import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { COLUMN_NAME_LOCALES, LOCALES, LOCALE_META, localeSuffix, type Locale } from "@/config/locales";
import { localize } from "@/lib/content";
import { setGeoActive, saveCityAction, saveCountryAction, saveRegionAction } from "./actions";

const input = "min-h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";
const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";

export default async function GeographyPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireDr("category.write");
  const sp = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("geo");
  const countries = await prisma.country.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: { regions: { orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] }, cities: { orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }], select: { id: true, slug: true, nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true, isActive: true, regionId: true } } },
  });
  const toggle = (entity: string, id: string, active: boolean) => (
    <form action={setGeoActive}><input type="hidden" name="entity" value={entity} /><input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={active ? "0" : "1"} />
      <button type="submit" className={btn}>{active ? t("deactivate") : t("activate")}</button></form>
  );
  // English is its own field (nameEn); the others are the translations. Regions take every configured language (translation rows).
  const names = (prefix: string) => (prefix === "region" ? LOCALES.filter((l) => l !== "en") : COLUMN_NAME_LOCALES).map((l) => (
    <label key={l} className="flex flex-col gap-1 text-xs font-semibold" lang={LOCALE_META[l].htmlLang}>{t("nameIn", { language: LOCALE_META[l].nativeName })}
      <input name={`name${localeSuffix(l)}`} dir={LOCALE_META[l].dir} maxLength={120} className={input} data-prefix={prefix} /></label>
  ));

  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold">{t("title")}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">{t("intro")}</p>
      {sp.saved && <p role="status" className="mb-4 rounded-xl bg-[oklch(0.95_0.05_150)] px-4 py-3 text-sm font-semibold text-[oklch(0.35_0.1_150)]">{t("saved")}</p>}
      {sp.error && <p role="alert" className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t(sp.error === "exists" ? "errorExists" : "errorInvalid")}</p>}

      <div className="space-y-6">
        {countries.map((c) => (
          <section key={c.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4" data-testid={`country-${c.code}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold"><bdi>{localize({ ...c, name: c.nameEn }, "name", locale).text}</bdi> <span className="text-sm font-normal text-muted" dir="ltr">{c.code}</span></h2>
              <div className="flex items-center gap-2 text-xs text-muted">{c.isActive ? t("active") : t("inactive")}{toggle("country", c.id, c.isActive)}</div>
            </div>
            {c.regions.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2 text-xs">
                {c.regions.map((r) => <li key={r.id} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1"><bdi>{r.nameEn}</bdi>{!r.isActive && <span className="text-muted">({t("inactive")})</span>}{toggle("region", r.id, r.isActive)}</li>)}
              </ul>
            )}
            <ul className="divide-y divide-line text-sm">
              {c.cities.map((city) => (
                <li key={city.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><bdi className="font-semibold">{localize({ ...city, name: city.nameEn }, "name", locale).text}</bdi> <span className="text-xs text-muted" dir="ltr">/city/{city.slug ?? "—"}</span>{!city.isActive && <span className="ms-2 text-xs text-muted">({t("inactive")})</span>}</span>
                  <span className="flex items-center gap-2"><Link href={`/dr/geography/city/${city.id}`} className={`${btn} inline-flex items-center`}>{t("edit")}</Link>{toggle("city", city.id, city.isActive)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <form action={saveCountryAction} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <h2 className="text-base font-bold">{t("addCountry")}</h2>
          <label className="flex flex-col gap-1 text-xs font-semibold">{t("code")}<input name="code" required maxLength={2} dir="ltr" className={input} /></label>
          <label className="flex flex-col gap-1 text-xs font-semibold">{t("nameEn")}<input name="nameEn" required maxLength={120} dir="ltr" className={input} /></label>
          <details><summary className="cursor-pointer text-xs font-semibold">{t("translations")}</summary><div className="mt-2 grid gap-2">{names("country")}</div></details>
          <button type="submit" className="min-h-10 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink hover:bg-brand-hover">{t("add")}</button>
        </form>
        <form action={saveRegionAction} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <h2 className="text-base font-bold">{t("addRegion")}</h2>
          <label className="flex flex-col gap-1 text-xs font-semibold">{t("country")}<select name="countryId" required className={input}>{countries.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold">{t("nameEn")}<input name="nameEn" required maxLength={120} dir="ltr" className={input} /></label>
          <details><summary className="cursor-pointer text-xs font-semibold">{t("translations")}</summary><div className="mt-2 grid gap-2">{names("region")}</div></details>
          <button type="submit" className="min-h-10 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink hover:bg-brand-hover">{t("add")}</button>
        </form>
        <form action={saveCityAction} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4" data-testid="city-form">
          <h2 className="text-base font-bold">{t("addCity")}</h2>
          <label className="flex flex-col gap-1 text-xs font-semibold">{t("country")}<select name="countryId" required className={input}>{countries.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold">{t("region")}<select name="regionId" className={input}><option value="">—</option>{countries.flatMap((c) => c.regions.map((r) => <option key={r.id} value={r.id}>{c.code} · {r.nameEn}</option>))}</select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold">{t("nameEn")}<input name="nameEn" required maxLength={120} dir="ltr" className={input} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold">{t("lat")}<input name="lat" inputMode="decimal" dir="ltr" className={input} /></label>
            <label className="flex flex-col gap-1 text-xs font-semibold">{t("lng")}<input name="lng" inputMode="decimal" dir="ltr" className={input} /></label>
          </div>
          <details><summary className="cursor-pointer text-xs font-semibold">{t("translations")}</summary><div className="mt-2 grid gap-2">{names("city")}</div></details>
          <button type="submit" className="min-h-10 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink hover:bg-brand-hover">{t("add")}</button>
        </form>
      </div>
    </>
  );
}
