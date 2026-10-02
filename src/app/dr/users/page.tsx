import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { ROLES, assignableRoles, can, canManageUser, type Role } from "@/lib/rbac";
import { formatDate, formatNumber, type Locale } from "@/i18n/locales";
import { Ltr } from "@/components/ui/Bidi";
import { createUserAction, updateUserAction } from "./actions";

const PER_PAGE = 30;
type Sp = { q?: string; role?: string; page?: string; error?: string; done?: string };
const ERRORS = ["invalid", "exists", "forbidden_role", "forbidden", "last_super_admin", "not_found"];
const DONE = ["created", "updated", "unchanged"];

export default async function DrUsers({ searchParams }: { searchParams: Promise<Sp> }) {
  const actor = await requireDr("user.read");
  const sp = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const q = sp.q?.trim().toLowerCase().slice(0, 120) || undefined;
  const role = ROLES.find((r) => r === sp.role);
  const page = Math.min(500, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const canWrite = can(actor.role, "user.write");
  const canRole = can(actor.role, "user.role");
  const roles = assignableRoles(actor.role);

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(role ? { role } : {}),
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: [{ role: "asc" }, { email: "asc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const field = "min-h-11 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";
  const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";
  const error = ERRORS.find((e) => e === sp.error);
  const done = DONE.find((d) => d === sp.done);

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">{t("dashboard.users")}</h1>
      {error && <p role="alert" data-testid="users-error" className="mb-6 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{t(`users.error_${error}`)}</p>}
      {done && <p role="status" data-testid="users-done" className="mb-6 rounded-xl bg-[oklch(0.95_0.05_150)] px-4 py-3 text-sm font-semibold text-[oklch(0.35_0.1_150)]">{t(`users.done_${done}`)}</p>}

      {canWrite && (
        <section aria-labelledby="new-user" className="mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 id="new-user" className="mb-1 text-base font-bold">{t("users.newTitle")}</h2>
          <p className="mb-4 text-sm text-muted">{t("users.newHint")}</p>
          <form action={createUserAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-sm font-semibold">{t("auth.name")}<input name="name" required minLength={2} maxLength={200} className={field} /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold">{t("auth.email")}<input name="email" type="email" required maxLength={200} dir="ltr" className={field} /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold">{t("auth.role")}
              <select name="role" required defaultValue={roles.includes("EMPLOYEE") ? "EMPLOYEE" : roles[0]} className={field}>{roles.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">{t("users.initialPassword")}<input name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" dir="ltr" className={field} /></label>
            <div className="flex items-end"><button type="submit" className="min-h-11 w-full rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink hover:bg-brand-hover">{t("users.create")}</button></div>
          </form>
        </section>
      )}

      <form role="search" className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">{t("common.search")}</label>
        <input id="q" name="q" defaultValue={q} placeholder={t("users.searchPlaceholder")} className={`${field} min-w-0 flex-1`} />
        <label htmlFor="role" className="sr-only">{t("auth.role")}</label>
        <select id="role" name="role" defaultValue={role ?? ""} className={field}>
          <option value="">{t("common.all")}</option>{ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </select>
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("list.apply")}</button>
      </form>
      <p aria-live="polite" className="mb-3 text-sm text-muted">{t("search.resultCount", { count: formatNumber(total, locale) })}</p>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-surface-2 text-muted"><tr>
            <th scope="col" className="px-4 py-3 text-start font-semibold">{t("dashboard.actor")}</th>
            <th scope="col" className="px-4 py-3 text-start font-semibold">{t("auth.role")}</th>
            <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
            <th scope="col" className="px-4 py-3 text-start font-semibold">{t("users.lastLogin")}</th>
            <th scope="col" className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((u) => {
              const manageable = canManageUser(actor, { id: u.id, role: u.role as Role });
              return (
                <tr key={u.id} data-testid="user-row">
                  <td className="px-4 py-3"><Ltr className="font-semibold">{u.email}</Ltr><div className="text-xs text-muted"><bdi>{u.name ?? "—"}</bdi>{u.id === actor.id ? ` · ${t("users.you")}` : ""}</div></td>
                  <td className="px-4 py-3">{t(`roles.${u.role}`)}</td>
                  <td className="px-4 py-3">{t(`status.${u.status === "suspended" ? "suspended" : "active"}`)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{u.lastLoginAt ? formatDate(u.lastLoginAt, locale, { dateStyle: "medium" }) : "—"}</td>
                  <td className="px-4 py-3">
                    {manageable && canWrite ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canRole && (
                          <form action={updateUserAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="id" value={u.id} />
                            <label className="sr-only" htmlFor={`role-${u.id}`}>{t("auth.role")}</label>
                            <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="min-h-9 rounded-lg border border-line bg-surface px-2 text-xs">{roles.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}</select>
                            <button type="submit" className={btn}>{t("users.changeRole")}</button>
                          </form>
                        )}
                        <form action={updateUserAction}>
                          <input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value={u.status === "suspended" ? "active" : "suspended"} />
                          <button type="submit" className={btn}>{u.status === "suspended" ? t("users.activate") : t("users.suspend")}</button>
                        </form>
                        <details className="relative">
                          <summary className={`${btn} inline-flex cursor-pointer list-none items-center`}>{t("users.resetPassword")}</summary>
                          <form action={updateUserAction} className="mt-2 flex gap-1.5">
                            <input type="hidden" name="id" value={u.id} />
                            <label className="sr-only" htmlFor={`pw-${u.id}`}>{t("users.newPassword")}</label>
                            <input id={`pw-${u.id}`} name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" dir="ltr" placeholder={t("users.newPassword")} className="min-h-9 rounded-lg border border-line bg-surface px-2 text-xs" />
                            <button type="submit" className={btn}>{t("common.save")}</button>
                          </form>
                        </details>
                      </div>
                    ) : <span className="text-xs text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label={t("common.page")} className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/dr/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(page - 1) })}`} className="font-semibold text-brand">{t("common.previous")}</Link> : <span />}
          <span className="text-muted">{t("common.page")} {page} {t("common.of")} {pages}</span>
          {page < pages ? <Link href={`/dr/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(page + 1) })}`} className="font-semibold text-brand">{t("common.next")}</Link> : <span />}
        </nav>
      )}
    </>
  );
}
