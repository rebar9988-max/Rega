import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireDr } from "@/lib/dr-auth";
import { can } from "@/lib/rbac";
import { serverEnv } from "@/lib/env";
import { getGateway, providerCatalog } from "@/lib/ai";
import { formatNumber, type Locale } from "@/i18n/locales";
import { Ltr } from "@/components/ui/Bidi";
import { probeProvider, setAssistantEnabled } from "./actions";

export default async function DrAi() {
  const user = await requireDr("aiconfig.read");
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const env = serverEnv();
  const day = new Date(new Date().toISOString().slice(0, 10));
  const [flag, usage, probes] = await Promise.all([
    prisma.featureFlag.findUnique({ where: { key: "public.aiSearch" }, select: { enabled: true } }),
    prisma.aiUsageDaily.aggregate({ where: { day }, _sum: { requests: true } }),
    prisma.auditLog.findMany({ where: { action: "ai.probe" }, orderBy: { createdAt: "desc" }, take: 40, select: { entityId: true, after: true } }),
  ]);
  // Latest probe per provider (audit rows hold only ok/kind/latency, never content).
  const lastProbe = new Map<string, { ok?: boolean; kind?: string | null; latencyMs?: number }>();
  for (const row of probes) if (row.entityId && !lastProbe.has(row.entityId)) lastProbe.set(row.entityId, (row.after ?? {}) as { ok?: boolean; kind?: string | null; latencyMs?: number });
  const on = Boolean(flag?.enabled);
  // Only booleans are shown: key values are never read into the page.
  const providers = providerCatalog();
  const active = new Map(getGateway().status().map((s) => [s.id, s]));
  const btn = "min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2";

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">{t("aiGateway")}</h1>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <div>
          <p className="font-bold">{on ? t("assistantOn") : t("assistantOff")}</p>
          <p className="text-sm text-muted">{t("mode")}: <Ltr>{env.AI_PROVIDER}</Ltr> · {t("requestsToday")}: {formatNumber(usage._sum.requests ?? 0, locale)}</p>
        </div>
        {can(user.role, "featureflag.write") && (
          <form action={setAssistantEnabled}>
            <input type="hidden" name="enabled" value={on ? "0" : "1"} />
            <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{on ? t("disableAssistant") : t("enableAssistant")}</button>
          </form>
        )}
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-surface-2 text-muted"><tr>{[t("provider"), t("model"), t("status"), t("circuit"), t("test"), tc("actions")].map((c) => <th key={c} scope="col" className="px-4 py-3 text-start font-semibold">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {providers.map(({ id, model, hasKey }) => {
              const s = active.get(id);
              return (
                <tr key={id}>
                  <td className="px-4 py-3 font-semibold"><Ltr>{id}</Ltr></td>
                  <td className="px-4 py-3"><Ltr>{model}</Ltr></td>
                  <td className="px-4 py-3">{hasKey ? t("configured") : t("notConfigured")}</td>
                  <td className="px-4 py-3">{s ? (s.circuit === "open" ? t("circuitOpen") : t("circuitClosed")) : "—"}</td>
                  <td className="px-4 py-3" data-testid={`probe-${id}`}>{lastProbe.has(id) ? (lastProbe.get(id)!.ok ? `${t("testOk")} · ${lastProbe.get(id)!.latencyMs}ms` : `${t("testFail")} · ${lastProbe.get(id)!.kind ?? ""}`) : "—"}</td>
                  <td className="px-4 py-3">{s && can(user.role, "aiconfig.write") && (
                    <form action={probeProvider}><input type="hidden" name="id" value={id} /><button type="submit" className={btn}>{t("test")}</button></form>
                  )}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
