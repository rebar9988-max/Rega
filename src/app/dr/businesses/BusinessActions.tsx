import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionMenu, MenuSeparator, menuItem, menuItemDanger } from "@/components/dr/ActionMenu";
import { BusinessActionButton } from "@/components/dr/BusinessActionButton";
import { ConfirmAction } from "@/components/dr/ConfirmAction";
import { DrIcon, type DrIconName } from "@/components/dr/icons";
import { deleteBusiness, recoverBusiness, updateBusiness } from "./actions";

export type ActionBusiness = { id: string; name: string; slug: string; status: string; verified: boolean; featured: boolean; deleted: boolean; isPublic: boolean };
export type ActionRights = { manages: boolean; canPublish: boolean; canPin: boolean; canDelete: boolean };

/**
 * Every action on one business, in one menu (list rows and the edit page use the same one). The menu only offers
 * what the role may do; the server actions check the same rules again, so a hidden button is never the protection.
 */
export async function BusinessActions({ b, rights, back, locale, showEdit }: { b: ActionBusiness; rights: ActionRights; back: string; locale: string; showEdit: boolean }) {
  const t = await getTranslations();
  const hidden = b.status === "archived";

  // A deleted listing can only be restored (administrators).
  if (b.deleted) {
    return rights.canDelete ? (
      <form action={recoverBusiness}>
        <input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={back} />
        <BusinessActionButton testId="recover-business" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2">
          <DrIcon name="restore" className="size-4" />{t("drAdmin.restore")}
        </BusinessActionButton>
      </form>
    ) : null;
  }

  const one = (intent: string, label: string, icon: DrIconName, testId?: string) => (
    <form action={updateBusiness}>
      <input type="hidden" name="id" value={b.id} /><input type="hidden" name="intent" value={intent} /><input type="hidden" name="back" value={back} />
      <BusinessActionButton className={menuItem} testId={testId}><DrIcon name={icon} className="size-4 text-muted" />{label}</BusinessActionButton>
    </form>
  );
  const general = [
    b.isPublic && <Link key="view" href={`/${locale}/business/${b.slug}`} target="_blank" rel="noopener" className={menuItem} data-testid="view-business"><DrIcon name="view" className="size-4 text-muted" />{t("drAdmin.view")}</Link>,
    showEdit && rights.manages && <Link key="edit" href={`/dr/businesses/${b.id}`} className={`${menuItem} sm:hidden`} data-testid="edit-business"><DrIcon name="edit" className="size-4 text-muted" />{t("bizForm.edit")}</Link>,
    rights.canPin && !hidden && <div key="pin">{b.featured ? one("unfeature", t("drAdmin.unpin"), "unpin", "unpin-business") : one("feature", t("drAdmin.pin"), "pin", "pin-business")}</div>,
    rights.canPublish && !hidden && b.status !== "pending" && <div key="publish">{b.status === "published" ? one("unpublish", t("dashboard.unpublish"), "draft") : one("publish", t("businessModeration.approve"), "publish")}</div>,
    rights.canPublish && !hidden && b.verified && <div key="unverify">{one("unverify", t("dashboard.unverify"), "shieldOff")}</div>,
  ].filter(Boolean);
  const visibility = rights.manages && (hidden ? one("restore", t("businessVisibility.unhide"), "view", "unhide-business") : (
    <ConfirmAction key="hide" action={updateBusiness} fields={{ id: b.id, intent: "archive", back }} icon="hide" triggerTestId="hide-business"
      trigger={t("businessVisibility.hide")} triggerClassName={menuItem}
      title={t("drAdmin.hideTitle")} body={<><strong className="font-semibold text-ink"><bdi>{b.name}</bdi></strong> — {t("businessVisibility.confirmHide")}</>}
      confirmLabel={t("businessVisibility.hide")} cancelLabel={t("common.cancel")} />
  ));
  const destructive = rights.canDelete && (
    <ConfirmAction action={deleteBusiness} fields={{ id: b.id, back }} icon="trash" tone="danger" triggerTestId="delete-business"
      trigger={t("drAdmin.delete")} triggerClassName={menuItemDanger}
      title={t("drAdmin.deleteTitle")} body={<><strong className="font-semibold text-ink"><bdi>{b.name}</bdi></strong> — {t("drAdmin.deleteBody")}</>}
      confirmLabel={t("drAdmin.deleteConfirm")} cancelLabel={t("common.cancel")} />
  );
  if (!general.length && !visibility && !destructive) return null;

  return (
    <ActionMenu label={t("drAdmin.actionsFor", { name: b.name })} testId="row-actions">
      {general}
      {visibility && general.length > 0 && <MenuSeparator />}
      {visibility}
      {destructive && <MenuSeparator />}
      {destructive}
    </ActionMenu>
  );
}
