import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { COLUMN_NAME_LOCALES, LOCALES, LOCALE_META, formatNumber, localeSuffix, type Locale } from "@/config/locales";
import { localize } from "@/lib/content";
import { ActionMenu, MenuSeparator } from "@/components/dr/ActionMenu";
import { ConfirmAction } from "@/components/dr/ConfirmAction";
import { StatusPill } from "@/components/dr/StatusPill";
import { DrIcon, type DrIconName } from "@/components/dr/icons";
import { menuItem, menuItemDanger } from "@/components/dr/menu-styles";
import { setGeoActive, saveCityAction, saveCountryAction, saveRegionAction } from "./actions";
import { GeoFilters } from "./GeoFilters";

const PER_PAGE = 25;
const TABS = ["cities", "regions", "countries"] as const;
type Tab = (typeof TABS)[number];
type Sp = { tab?: string; q?: string; country?: string; region?: string; status?: string; page?: string; saved?: string; error?: string };

const input = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";
const select = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface ps-3 pe-8 text-sm text-ink outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted";
const COUNTRY_NAMES = { nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true } as const;
const fold = (s: string) => s.normalize("NFKC").toLocaleLowerCase();

export default async function GeographyPage({ searchParams }: { searchParams: Promise<Sp> }) {
  await requireDr("category.write");
  const sp = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("geo");
  const tr = await getTranslations();

  const tab: Tab = TABS.find((x) => x === sp.tab) ?? "cities";
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const status = sp.status === "active" || sp.status === "inactive" ? sp.status : undefined;
  const page = Math.min(1000, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));

  // Countries and regions are short lists (read once); cities run into the thousands and are paged in the database.
  const [countries, regions, cityTotal] = await Promise.all([
    prisma.country.findMany({ orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }, { id: "asc" }], select: { id: true, code: true, isActive: true, ...COUNTRY_NAMES } }),
    prisma.region.findMany({
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }, { id: "asc" }],
      select: { id: true, countryId: true, slug: true, nameEn: true, isActive: true, translations: { where: { locale }, select: { name: true }, take: 1 } },
    }),
    prisma.city.count(),
  ]);
  const countryById = new Map(countries.map((c) => [c.id, c]));
  const regionById = new Map(regions.map((r) => [r.id, r]));
  const countryName = (c: (typeof countries)[number]) => localize({ ...c, name: c.nameEn }, "name", locale).text;
  const regionName = (r: (typeof regions)[number]) => r.translations[0]?.name || r.nameEn;

  // Hierarchy: a region implies its country; a region of another country is ignored.
  const regionParam = sp.region ? regionById.get(sp.region) : undefined;
  const country = (sp.country ? countryById.get(sp.country) : undefined) ?? (regionParam ? countryById.get(regionParam.countryId) : undefined);
  const region = regionParam && (!country || regionParam.countryId === country.id) ? regionParam : undefined;
  const countryRegions = country ? regions.filter((r) => r.countryId === country.id) : [];
  const statusMatch = (active: boolean) => !status || active === (status === "active");

  // URLs: every view is a plain link, so state survives reloads and is shareable.
  const link = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString();
    return `/dr/geography${s ? `?${s}` : ""}`;
  };
  const current = { tab: tab === "cities" ? undefined : tab, q, country: tab === "countries" ? undefined : country?.id, region: tab === "cities" ? region?.id : undefined, status };
  const href = (p: number) => link({ ...current, page: p > 1 ? String(p) : undefined });
  const back = href(page);
  const filtered = Boolean(q || status || (tab !== "countries" && country) || (tab === "cities" && region));

  // ---- rows of the active tab -------------------------------------------------------------------------------------
  let total = 0;
  let countryRows: (typeof countries)[number][] = [];
  let regionRows: (typeof regions)[number][] = [];
  let cityRows: { id: string; slug: string | null; nameEn: string; isActive: boolean; countryId: string; regionId: string | null; latitude: number | null; longitude: number | null }[] = [];
  let citiesPerCountry = new Map<string, number>();
  let regionsPerCountry = new Map<string, number>();
  let citiesPerRegion = new Map<string, number>();
  const slice = <T,>(rows: T[]) => { total = rows.length; return rows.slice((page - 1) * PER_PAGE, page * PER_PAGE); };

  if (tab === "countries") {
    const needle = q ? fold(q) : "";
    countryRows = slice(countries.filter((c) => statusMatch(c.isActive) && (!needle || [c.code, ...Object.keys(COUNTRY_NAMES).map((k) => (c as Record<string, unknown>)[k])].some((v) => typeof v === "string" && fold(v).includes(needle)))));
    const grouped = await prisma.city.groupBy({ by: ["countryId"], where: { countryId: { in: countryRows.map((c) => c.id) } }, _count: { _all: true } });
    citiesPerCountry = new Map(grouped.map((g) => [g.countryId, g._count._all]));
    regionsPerCountry = new Map(countryRows.map((c) => [c.id, regions.filter((r) => r.countryId === c.id).length]));
  } else if (tab === "regions") {
    const needle = q ? fold(q) : "";
    regionRows = slice(regions.filter((r) => (!country || r.countryId === country.id) && statusMatch(r.isActive) && (!needle || [r.nameEn, r.slug, r.translations[0]?.name].some((v) => v && fold(v).includes(needle)))));
    const grouped = await prisma.city.groupBy({ by: ["regionId"], where: { regionId: { in: regionRows.map((r) => r.id) } }, _count: { _all: true } });
    citiesPerRegion = new Map(grouped.flatMap((g) => (g.regionId ? [[g.regionId, g._count._all] as const] : [])));
  } else {
    // Case-insensitive name/slug search on the columns D1 folds (src/lib/d1-fold-fields.json) and the translation rows.
    const text = { contains: q ?? "", mode: "insensitive" as const };
    const where: Prisma.CityWhereInput = {
      ...(country ? { countryId: country.id } : {}),
      ...(region ? { regionId: region.id } : {}),
      ...(status ? { isActive: status === "active" } : {}),
      ...(q ? { OR: [{ nameEn: text }, { nameCkb: text }, { nameKmr: text }, { nameDe: text }, { nameAr: text }, { nameFa: text }, { nameTr: text }, { slug: text }, { translations: { some: { name: text } } }] } : {}),
    };
    const [n, rows] = await Promise.all([
      prisma.city.count({ where }),
      prisma.city.findMany({
        where, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }, { id: "asc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE,
        select: { id: true, slug: true, nameEn: true, nameCkb: true, nameKmr: true, nameDe: true, nameAr: true, nameFa: true, nameTr: true, isActive: true, countryId: true, regionId: true, latitude: true, longitude: true },
      }),
    ]);
    total = n;
    cityRows = rows;
  }
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const shown = tab === "countries" ? countryRows.length : tab === "regions" ? regionRows.length : cityRows.length;

  // ---- shared pieces ----------------------------------------------------------------------------------------------
  const num = (n: number) => formatNumber(n, locale);
  const tabs: { key: Tab; label: string; icon: DrIconName; n: number }[] = [
    { key: "countries", label: t("tabCountries"), icon: "geography", n: countries.length },
    { key: "regions", label: t("tabRegions"), icon: "overview", n: regions.length },
    { key: "cities", label: t("tabCities"), icon: "mapPin", n: cityTotal },
  ];
  const addLabel = tab === "countries" ? t("addCountry") : tab === "regions" ? t("addRegion") : t("addCity");
  const notice = sp.saved === "activated" ? t("noticeActivated") : sp.saved === "deactivated" ? t("noticeDeactivated") : sp.saved ? t("saved") : null;

  const statusToggle = (entity: "country" | "region" | "city", id: string, name: string, active: boolean) => (
    <ConfirmAction action={setGeoActive} fields={{ entity, id, active: active ? "0" : "1", back }}
      trigger={active ? t("deactivate") : t("activate")} triggerClassName={active ? menuItemDanger : menuItem} triggerTestId={`toggle-${entity}`}
      icon={active ? "hide" : "view"} tone={active ? "danger" : "neutral"}
      title={t(active ? "confirmDeactivateTitle" : "confirmActivateTitle", { name })} body={t(active ? "confirmDeactivateBody" : "confirmActivateBody")}
      confirmLabel={active ? t("deactivate") : t("activate")} cancelLabel={tr("common.cancel")} />
  );
  const pill = (active: boolean) => <StatusPill status={active ? "published" : "draft"} label={active ? t("active") : t("inactive")} />;
  const row = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 transition-colors md:table-row md:p-0 md:hover:bg-surface-2/60";
  const th = "px-3 py-3 text-start";
  const cell = "hidden px-3 py-3 text-ink/80 md:table-cell";
  const nameCell = "col-start-1 row-start-1 min-w-0 md:px-4 md:py-3";
  const statusCell = "col-start-1 row-start-2 min-w-0 md:px-3 md:py-3";
  const actionCell = "col-start-2 row-span-2 row-start-1 self-center md:px-4 md:py-3";
  const sub = "mt-0.5 truncate text-xs text-muted";
  const names = (prefix: string) => (prefix === "region" ? LOCALES.filter((l) => l !== "en") : COLUMN_NAME_LOCALES).map((l) => (
    <label key={l} className="flex flex-col gap-1 text-xs font-semibold" lang={LOCALE_META[l].htmlLang}>{t("nameIn", { language: LOCALE_META[l].nativeName })}
      <input name={`name${localeSuffix(l)}`} dir={LOCALE_META[l].dir} maxLength={120} className={input} data-prefix={prefix} /></label>
  ));
  const formBox = "space-y-4 rounded-xl border border-line bg-surface p-4 shadow-card";
  const formTitle = "border-b border-line pb-3 text-base font-bold";
  const submit = <button type="submit" className="min-h-11 w-full rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink transition hover:bg-brand-hover">{t("add")}</button>;
  const translationsBox = (prefix: string) => <details className="rounded-lg"><summary className="flex min-h-10 cursor-pointer items-center text-xs font-semibold">{t("translations")}</summary><div className="mt-2 grid gap-2">{names(prefix)}</div></details>;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl! leading-tight! font-extrabold tracking-tight text-ink sm:text-[1.75rem]!">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("intro")}</p>
        </div>
        <a href="#geo-add" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink shadow-card transition hover:bg-brand-hover lg:hidden">
          <DrIcon name="plus" className="size-[18px]" />{addLabel}
        </a>
      </header>

      {notice && <p role="status" data-testid="geo-notice" className="mb-4 flex items-center gap-2 rounded-xl border border-[oklch(0.62_0.15_150)]/30 bg-[oklch(0.95_0.05_150)] px-4 py-3 text-sm font-semibold text-[oklch(0.35_0.1_150)]"><DrIcon name="check" className="size-[18px] shrink-0" />{notice}</p>}
      {sp.error && <p role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm font-semibold text-ink"><DrIcon name="alert" className="size-[18px] shrink-0 text-brand-text" />{t(sp.error === "exists" ? "errorExists" : "errorInvalid")}</p>}

      {/* Country → region → city: one tab per level; the country filter travels with the tab. */}
      <nav aria-label={t("title")} className="mb-4" data-testid="geo-tabs">
        <ul className="grid grid-cols-3 gap-1.5 rounded-xl border border-line bg-surface-2 p-1.5">
          {tabs.map((x) => (
            <li key={x.key} className="min-w-0">
              <Link href={link({ tab: x.key === "cities" ? undefined : x.key, country: x.key === "countries" ? undefined : country?.id })} aria-current={tab === x.key ? "page" : undefined} data-testid={`geo-tab-${x.key}`}
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-center transition sm:flex-row sm:gap-2 ${tab === x.key ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-ink/75 hover:bg-surface/60 hover:text-ink"}`}>
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold"><DrIcon name={x.icon} className={`hidden size-4 shrink-0 sm:block ${tab === x.key ? "text-brand-text" : ""}`} /><span className="truncate">{x.label}</span></span>
                <span className={`rounded-full px-2 text-xs font-bold tabular-nums ${tab === x.key ? "bg-brand-soft text-brand-text" : "bg-surface/70"}`}>{num(x.n)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <GeoFilters label={tr("common.search")} pendingLabel={t("loading")}
            className="group mb-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-3 xl:flex xl:flex-wrap xl:items-center">
            {tab !== "cities" && <input type="hidden" name="tab" value={tab} />}
            <div className="relative col-span-2 min-w-0 xl:min-w-56 xl:flex-1">
              <label htmlFor="geo-q" className="sr-only">{tr("common.search")}</label>
              <DrIcon name="search" className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
              <input id="geo-q" name="q" type="search" defaultValue={q} maxLength={80} autoComplete="off" placeholder={t(tab === "countries" ? "searchCountries" : tab === "regions" ? "searchRegions" : "searchCities")}
                className="min-h-11 w-full rounded-xl border border-line bg-surface-2 ps-10 pe-3 text-sm outline-none transition focus:border-brand focus:bg-surface" />
            </div>
            {tab !== "countries" && (
              <div className="min-w-0 xl:w-44">
                <label htmlFor="geo-country" className="sr-only">{t("country")}</label>
                <select id="geo-country" name="country" defaultValue={country?.id ?? ""} className={select}>
                  <option value="">{t("allCountries")}</option>
                  {countries.map((c) => <option key={c.id} value={c.id}>{countryName(c)}</option>)}
                </select>
              </div>
            )}
            {tab === "cities" && (
              <div className="min-w-0 xl:w-44">
                <label htmlFor="geo-region" className="sr-only">{t("region")}</label>
                <select id="geo-region" name="region" defaultValue={region?.id ?? ""} disabled={!country || countryRegions.length === 0} title={country ? undefined : t("chooseCountryFirst")} className={select}>
                  <option value="">{t("allRegions")}</option>
                  {countryRegions.map((r) => <option key={r.id} value={r.id}>{regionName(r)}</option>)}
                </select>
              </div>
            )}
            <div className={`min-w-0 xl:w-36 ${tab === "regions" ? "" : "col-span-2"}`}>
              <label htmlFor="geo-status" className="sr-only">{tr("common.status")}</label>
              <select id="geo-status" name="status" defaultValue={status ?? ""} className={select}>
                <option value="">{t("allStatuses")}</option>
                <option value="active">{t("active")}</option>
                <option value="inactive">{t("inactive")}</option>
              </select>
            </div>
            <noscript><button type="submit" className="min-h-11 w-full rounded-xl bg-ink px-5 text-sm font-semibold text-surface">{tr("list.apply")}</button></noscript>
          </GeoFilters>

          <div className="mb-2 flex min-h-8 flex-wrap items-center justify-between gap-2 px-1 text-sm">
            <p aria-live="polite" className="text-muted" data-testid="geo-count">{tr("search.resultCount", { count: num(total) })}</p>
            {filtered && <Link href={link({ tab: current.tab })} className="font-semibold text-brand-text hover:underline">{tr("drAdmin.clear")}</Link>}
          </div>

          {shown === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center" data-testid="empty-list">
              <span aria-hidden="true" className="mb-3 grid size-12 place-items-center rounded-full bg-surface-2 text-muted"><DrIcon name="geography" className="size-6" /></span>
              <p className="font-semibold text-ink">{filtered ? t("emptyFiltered") : t("empty")}</p>
              {filtered && <Link href={link({ tab: current.tab })} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-brand-text hover:underline">{tr("drAdmin.clear")}</Link>}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-surface shadow-card">
              <table className="block w-full text-sm md:table" data-testid={`geo-table-${tab}`}>
                {tab === "countries" && (
                  <>
                    <thead className="sr-only md:not-sr-only md:table-header-group">
                      <tr className="border-b border-line text-xs font-semibold text-muted">
                        <th scope="col" className="px-4 py-3 text-start">{t("country")}</th>
                        <th scope="col" className={th}>{t("colRegions")}</th>
                        <th scope="col" className={th}>{t("colCities")}</th>
                        <th scope="col" className={th}>{tr("common.status")}</th>
                        <th scope="col" className="px-4 py-3 text-end"><span className="sr-only">{tr("common.actions")}</span></th>
                      </tr>
                    </thead>
                    <tbody className="block divide-y divide-line md:table-row-group">
                      {countryRows.map((c) => {
                        const name = countryName(c);
                        const nr = regionsPerCountry.get(c.id) ?? 0;
                        const nc = citiesPerCountry.get(c.id) ?? 0;
                        return (
                          <tr key={c.id} className={row} data-testid={`country-${c.code}`}>
                            <td className={nameCell}>
                              <div className="flex min-w-0 items-center gap-2"><bdi className="truncate font-semibold text-ink">{name}</bdi><span dir="ltr" className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-muted">{c.code}</span></div>
                              <p className={`${sub} md:hidden`}>{t("colRegions")}: {num(nr)} · {t("colCities")}: {num(nc)}</p>
                            </td>
                            <td className={`${cell} tabular-nums`}>{num(nr)}</td>
                            <td className={`${cell} tabular-nums`}>{num(nc)}</td>
                            <td className={statusCell}>{pill(c.isActive)}</td>
                            <td className={actionCell}>
                              <div className="flex justify-end">
                                <ActionMenu label={t("moreActions", { name })} testId={`menu-country-${c.code}`}>
                                  <Link href={link({ tab: "regions", country: c.id })} className={menuItem}><DrIcon name="overview" className="size-4 text-muted" />{t("showRegions")}</Link>
                                  <Link href={link({ country: c.id })} className={menuItem}><DrIcon name="mapPin" className="size-4 text-muted" />{t("showCities")}</Link>
                                  <MenuSeparator />
                                  {statusToggle("country", c.id, name, c.isActive)}
                                </ActionMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </>
                )}
                {tab === "regions" && (
                  <>
                    <thead className="sr-only md:not-sr-only md:table-header-group">
                      <tr className="border-b border-line text-xs font-semibold text-muted">
                        <th scope="col" className="px-4 py-3 text-start">{t("region")}</th>
                        <th scope="col" className={th}>{t("country")}</th>
                        <th scope="col" className={th}>{t("colCities")}</th>
                        <th scope="col" className={th}>{tr("common.status")}</th>
                        <th scope="col" className="px-4 py-3 text-end"><span className="sr-only">{tr("common.actions")}</span></th>
                      </tr>
                    </thead>
                    <tbody className="block divide-y divide-line md:table-row-group">
                      {regionRows.map((r) => {
                        const name = regionName(r);
                        const parent = countryById.get(r.countryId);
                        const nc = citiesPerRegion.get(r.id) ?? 0;
                        return (
                          <tr key={r.id} className={row} data-testid="region-row">
                            <td className={nameCell}>
                              <bdi className="block truncate font-semibold text-ink">{name}</bdi>
                              <p className={sub}><span className="md:hidden">{parent ? <bdi>{countryName(parent)}</bdi> : "—"} · {t("colCities")}: {num(nc)}</span><span dir="ltr" className="hidden md:inline">{r.slug}</span></p>
                            </td>
                            <td className={cell}>{parent ? <bdi>{countryName(parent)}</bdi> : "—"}</td>
                            <td className={`${cell} tabular-nums`}>{num(nc)}</td>
                            <td className={statusCell}>{pill(r.isActive)}{parent && !parent.isActive && <span className="ms-2 text-xs text-muted">({t("country")}: {t("inactive")})</span>}</td>
                            <td className={actionCell}>
                              <div className="flex justify-end">
                                <ActionMenu label={t("moreActions", { name })} testId={`menu-region-${r.slug}`}>
                                  <Link href={link({ country: r.countryId, region: r.id })} className={menuItem}><DrIcon name="mapPin" className="size-4 text-muted" />{t("showCities")}</Link>
                                  <MenuSeparator />
                                  {statusToggle("region", r.id, name, r.isActive)}
                                </ActionMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </>
                )}
                {tab === "cities" && (
                  <>
                    <thead className="sr-only md:not-sr-only md:table-header-group">
                      <tr className="border-b border-line text-xs font-semibold text-muted">
                        <th scope="col" className="px-4 py-3 text-start">{t("tabCities")}</th>
                        <th scope="col" className={th}>{t("region")}</th>
                        <th scope="col" className={`${th} hidden lg:table-cell`}>{t("country")}</th>
                        <th scope="col" className={`${th} hidden xl:table-cell`}>{t("coordinates")}</th>
                        <th scope="col" className={th}>{tr("common.status")}</th>
                        <th scope="col" className="px-4 py-3 text-end"><span className="sr-only">{tr("common.actions")}</span></th>
                      </tr>
                    </thead>
                    <tbody className="block divide-y divide-line md:table-row-group">
                      {cityRows.map((city) => {
                        const name = localize({ ...city, name: city.nameEn }, "name", locale).text;
                        const parent = countryById.get(city.countryId);
                        const reg = city.regionId ? regionById.get(city.regionId) : undefined;
                        const coords = city.latitude != null && city.longitude != null ? `${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)}` : "—";
                        const place = [reg ? regionName(reg) : null, parent ? countryName(parent) : null].filter(Boolean).join(" · ") || "—";
                        return (
                          <tr key={city.id} className={row} data-testid="city-row">
                            <td className={nameCell}>
                              <Link href={`/dr/geography/city/${city.id}`} className="block truncate font-semibold text-ink hover:text-brand-text hover:underline"><bdi>{name}</bdi></Link>
                              <p className={`${sub} md:hidden`}><bdi>{place}</bdi></p>
                              <p className={`${sub} hidden md:block`} dir="ltr"><span className="block truncate text-start">/city/{city.slug ?? "—"}</span></p>
                            </td>
                            <td className={cell}><span className="line-clamp-2">{reg ? <bdi>{regionName(reg)}</bdi> : "—"}</span></td>
                            <td className="hidden px-3 py-3 text-ink/80 lg:table-cell">{parent ? <bdi>{countryName(parent)}</bdi> : "—"}</td>
                            <td className="hidden whitespace-nowrap px-3 py-3 tabular-nums text-muted xl:table-cell" dir="ltr">{coords}</td>
                            <td className={statusCell}>
                              <div className="flex flex-wrap items-center gap-x-3">
                                {pill(city.isActive)}
                                <details className="group/d min-w-0 open:basis-full md:hidden">
                                  <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 text-xs font-semibold text-muted [&::-webkit-details-marker]:hidden">
                                    <DrIcon name="chevron" className="size-3.5 transition group-open/d:rotate-90 rtl:rotate-180 rtl:group-open/d:rotate-90" />{t("details")}
                                  </summary>
                                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-xs">
                                    <dt className="text-muted">{t("slug")}</dt><dd dir="ltr" className="truncate text-start font-medium">/city/{city.slug ?? "—"}</dd>
                                    <dt className="text-muted">{t("coordinates")}</dt><dd dir="ltr" className="text-start font-medium tabular-nums">{coords}</dd>
                                  </dl>
                                </details>
                              </div>
                            </td>
                            <td className={actionCell}>
                              <div className="flex justify-end">
                                <ActionMenu label={t("moreActions", { name })} testId={`menu-city-${city.slug ?? city.id}`}>
                                  <Link href={`/dr/geography/city/${city.id}`} className={menuItem}><DrIcon name="edit" className="size-4 text-muted" />{t("edit")}</Link>
                                  <MenuSeparator />
                                  {statusToggle("city", city.id, name, city.isActive)}
                                </ActionMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          )}

          {pages > 1 && (
            <nav aria-label={tr("common.page")} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="geo-pagination">
              <span className="text-muted">{tr("common.page")} {num(Math.min(page, pages))} {tr("common.of")} {num(pages)}</span>
              <div className="flex flex-wrap items-center gap-1">
                {page > 1 && <Link href={href(Math.min(page, pages) - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line bg-surface px-3 font-semibold hover:bg-surface-2"><DrIcon name="chevron" className="size-4 rotate-180 rtl:rotate-0" /><span className="sr-only sm:not-sr-only">{tr("common.previous")}</span></Link>}
                {[...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b).map((p) => (
                  <Link key={p} href={href(p)} aria-current={p === page ? "page" : undefined}
                    className={`grid min-h-11 min-w-11 place-items-center rounded-lg px-2 font-semibold tabular-nums ${p === page ? "bg-brand text-brand-ink" : "border border-line bg-surface hover:bg-surface-2"}`}>{num(p)}</Link>
                ))}
                {page < pages && <Link href={href(page + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line bg-surface px-3 font-semibold hover:bg-surface-2"><span className="sr-only sm:not-sr-only">{tr("common.next")}</span><DrIcon name="chevron" className="size-4 rtl:rotate-180" /></Link>}
              </div>
            </nav>
          )}
        </div>

        {/* The add form of the active level. Field names and server actions are unchanged. */}
        <aside id="geo-add" aria-label={addLabel} className="scroll-mt-20 lg:sticky lg:top-20">
          {tab === "countries" && (
            <form action={saveCountryAction} className={formBox} data-testid="country-form">
              <input type="hidden" name="back" value={link({ tab: "countries" })} />
              <h2 className={formTitle}>{t("addCountry")}</h2>
              <label className="flex flex-col gap-1 text-xs font-semibold">{t("code")}<input name="code" required maxLength={2} dir="ltr" className={input} /></label>
              <label className="flex flex-col gap-1 text-xs font-semibold">{t("nameEn")}<input name="nameEn" required maxLength={120} dir="ltr" className={input} /></label>
              {translationsBox("country")}
              {submit}
            </form>
          )}
          {tab === "regions" && (
            <form action={saveRegionAction} className={formBox} data-testid="region-form">
              <input type="hidden" name="back" value={link({ tab: "regions", country: country?.id })} />
              <h2 className={formTitle}>{t("addRegion")}</h2>
              <label className="flex flex-col gap-1 text-xs font-semibold">{t("country")}<select name="countryId" required defaultValue={country?.id} className={select}>{countries.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-xs font-semibold">{t("nameEn")}<input name="nameEn" required maxLength={120} dir="ltr" className={input} /></label>
              {translationsBox("region")}
              {submit}
            </form>
          )}
          {tab === "cities" && (
            <form action={saveCityAction} className={formBox} data-testid="city-form">
              <h2 className={formTitle}>{t("addCity")}</h2>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold">{t("country")}<select name="countryId" required defaultValue={country?.id} className={select}>{countries.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}</select></label>
                <label className="flex flex-col gap-1 text-xs font-semibold">{t("region")}<select name="regionId" defaultValue={region?.id ?? ""} className={select}><option value="">—</option>{countries.flatMap((c) => regions.filter((r) => r.countryId === c.id).map((r) => <option key={r.id} value={r.id}>{c.code} · {r.nameEn}</option>))}</select></label>
              </div>
              <label className="flex flex-col gap-1 text-xs font-semibold">{t("nameEn")}<input name="nameEn" required maxLength={120} dir="ltr" className={input} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold">{t("lat")}<input name="lat" inputMode="decimal" dir="ltr" className={input} /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold">{t("lng")}<input name="lng" inputMode="decimal" dir="ltr" className={input} /></label>
              </div>
              {translationsBox("city")}
              {submit}
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
