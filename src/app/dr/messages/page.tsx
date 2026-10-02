import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { formatDate, type Locale } from "@/config/locales";
import { setMessageStatus } from "./actions";

const STATUSES = ["new", "read", "replied", "spam"] as const;

export default async function MessagesAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireDr("review.moderate");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("inbox");
  const tl = await getTranslations("list");
  const where: Prisma.ContactMessageWhereInput = status ? { status } : {};
  const rows = await prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";
  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold">{t("messagesTitle")}</h1>
      <nav aria-label={t("messagesTitle")} className="mb-6 flex flex-wrap gap-2 text-sm">
        {[undefined, ...STATUSES].map((s) => (
          <a key={s ?? "all"} href={s ? `/dr/messages?status=${s}` : "/dr/messages"} aria-current={s === status ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full border px-3 font-semibold ${s === status ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>{s ? t(`msg_${s}`) : t("all")}</a>
        ))}
      </nav>
      {rows.length === 0 ? <p className="text-muted">{t("empty")}</p> : (
        <ul className="space-y-4">
          {rows.map((m) => (
            <li key={m.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm" data-testid="message-row">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold"><bdi>{m.subject}</bdi> <span className="font-normal text-muted">· {t(`msg_${m.status as "new"}`)}</span></span>
                <time dateTime={m.createdAt.toISOString()} className="text-xs text-muted">{formatDate(m.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              <p className="mb-2 text-xs text-muted"><bdi>{m.name}</bdi>{m.email && <> · <a href={`mailto:${m.email}`} dir="ltr" className="text-brand underline">{m.email}</a></>} · {m.locale}</p>
              <p className="mb-3 whitespace-pre-line" dir="auto">{m.message}</p>
              <form action={setMessageStatus} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={m.id} />
                <label className="sr-only" htmlFor={`mstatus-${m.id}`}>{t("setStatus")}</label>
                <select id={`mstatus-${m.id}`} name="status" defaultValue="" required className="min-h-9 rounded-lg border border-line bg-surface px-2 text-xs">
                  <option value="" disabled>{t("setStatus")}</option>
                  {STATUSES.filter((s) => s !== m.status).map((s) => <option key={s} value={s}>{t(`msgmark_${s}`)}</option>)}
                </select>
                <button type="submit" className={btn}>{tl("apply")}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
