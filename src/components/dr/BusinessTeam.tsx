import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Ltr } from "@/components/ui/Bidi";
import { addBusinessMember, removeBusinessMember } from "@/app/dr/businesses/team-actions";

/**
 * Members of a business: staff accounts limited to EMPLOYEE access may edit only the businesses they belong to.
 * Shown to roles that manage users; every change is checked again in the server actions.
 */
export async function BusinessTeam({ businessId }: { businessId: string }) {
  const t = await getTranslations();
  const members = await prisma.businessMember.findMany({
    where: { businessId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  const field = "min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";
  return (
    <section aria-labelledby="biz-team" className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5" data-testid="business-team">
      <h2 id="biz-team" className="mb-1 text-base font-bold">{t("team.title")}</h2>
      <p className="mb-4 text-sm text-muted">{t("team.hint")}</p>
      {members.length === 0 ? <p className="mb-4 text-sm text-muted">{t("team.empty")}</p> : (
        <ul className="mb-4 divide-y divide-line">
          {members.map(({ user }) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span><Ltr className="font-semibold">{user.email}</Ltr> <span className="text-muted">· {t(`roles.${user.role}`)}</span></span>
              <form action={removeBusinessMember}>
                <input type="hidden" name="businessId" value={businessId} /><input type="hidden" name="userId" value={user.id} />
                <button type="submit" className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2">{t("team.remove")}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={addBusinessMember} className="flex flex-wrap gap-2">
        <input type="hidden" name="businessId" value={businessId} />
        <label htmlFor="team-email" className="sr-only">{t("team.email")}</label>
        <input id="team-email" name="email" type="email" required dir="ltr" maxLength={200} placeholder={t("team.email")} className={field} />
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{t("team.add")}</button>
      </form>
    </section>
  );
}
