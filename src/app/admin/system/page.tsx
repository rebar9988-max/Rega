import project from "@/config/project.json";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireDr } from "@/lib/dr-auth";
import { prisma } from "@/lib/db";
import { isEnabled } from "@/lib/flags";
import { isStorageConfigured } from "@/lib/env";
import { MANAGED_FLAGS } from "@/lib/control-center";
import { setSystemFlag } from "./actions";

export default async function SystemCenter() {
  await requireDr("settings.write"); // fresh account guard; Super Admin only, including direct requests
  const t = await getTranslations("controlCenter");
  const checks = [
    { label: t("database"), configured: Boolean(process.env.DATABASE_URL) },
    { label: t("authentication"), configured: Boolean(process.env.AUTH_SECRET) },
    { label: t("media"), configured: isStorageConfigured() },
    { label: t("email"), configured: process.env.EMAIL_PROVIDER === "resend" && Boolean(process.env.RESEND_API_KEY) },
    { label: t("python"), configured: Boolean(process.env.AI_SERVICE_URL && process.env.AI_SERVICE_TOKEN) },
  ];
  const flags = await Promise.all(MANAGED_FLAGS.map(async key => ({ key, enabled: await isEnabled(key) })));
  const changes = await prisma.auditLog.findMany({ where: { action: "system.featureflag.update" }, orderBy: { createdAt: "desc" }, take: 10,
    select: { id: true, entityId: true, createdAt: true } });
  return <>
    <h1 className="mb-2 text-2xl font-extrabold">{t("title")}</h1>
    <p className="mb-6 text-muted">{t("description")}</p>
    <nav aria-label={t("services")} className="mb-6 flex flex-wrap gap-4">
      <a href={`https://dash.cloudflare.com/${project.cloudflareAccountId}`} className="inline-flex min-h-11 items-center font-semibold text-brand underline">Cloudflare</a>
      <a href={`https://console.neon.tech/app/projects/${project.neonProjectId}`} className="inline-flex min-h-11 items-center font-semibold text-brand underline">Neon</a>
      <a href={`https://github.com/${project.repository}/actions`} className="inline-flex min-h-11 items-center font-semibold text-brand underline">GitHub</a>
    </nav>
    <section className="mb-6 rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-lg font-bold">{t("configuration")}</h2>
      <p className="mb-4 text-sm text-muted">{t("configurationHint")}</p>
      <dl className="grid gap-3 sm:grid-cols-2">{checks.map(check => <div key={check.label} className="flex flex-wrap justify-between gap-2 rounded-lg border border-line p-3">
        <dt className="font-semibold">{check.label}</dt><dd>{check.configured ? t("configured") : t("missing")}</dd>
      </div>)}</dl>
      {/* Health is JSON, not a Next page: use a full navigation without RSC prefetch. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/api/v1/health" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand underline">{t("health")}</a>
    </section>
    <section className="mb-6 rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-lg font-bold">{t("settings")}</h2>
      {flags.map(flag => <form key={flag.key} action={setSystemFlag} className="flex flex-wrap items-center justify-between gap-3">
        <span>{t("reviews")} · {flag.enabled ? t("enabled") : t("disabled")}</span>
        <input type="hidden" name="key" value={flag.key} /><input type="hidden" name="enabled" value={flag.enabled ? "0" : "1"} />
        <button className="min-h-11 rounded-xl border border-line px-4 font-semibold hover:bg-surface-2">{flag.enabled ? t("disableReviews") : t("enableReviews")}</button>
      </form>)}
      <Link prefetch={false} href="/admin/ai" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand underline">{t("ai")}</Link>
    </section>
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-lg font-bold">{t("recentChanges")}</h2>
      {changes.length ? <ul className="space-y-2">{changes.map(change => <li key={change.id} className="flex flex-wrap justify-between gap-2 text-sm">
        <bdi>{change.entityId}</bdi><time dateTime={change.createdAt.toISOString()}>{change.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</time>
      </li>)}</ul> : <p className="text-muted">{t("noChanges")}</p>}
      <Link prefetch={false} href="/admin/audit" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand underline">{t("audit")}</Link>
    </section>
  </>;
}
