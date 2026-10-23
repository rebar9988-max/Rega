import { getTranslations } from "next-intl/server";
import { BusinessActionButton } from "@/components/dr/BusinessActionButton";
import { updateBusiness } from "./actions";

/**
 * Hide / show again for one business (list row and edit page). Hiding asks first and deletes nothing; every rule
 * (permission, membership, who may show it again, moderation) is enforced by `updateBusiness` on the server.
 */
export async function VisibilityControl({ id, hidden, back, className }: { id: string; hidden: boolean; back: string; className: string }) {
  const t = await getTranslations("businessVisibility");
  return (
    <form action={updateBusiness}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value={hidden ? "restore" : "archive"} />
      <input type="hidden" name="back" value={back} />
      <BusinessActionButton className={className} confirmText={hidden ? undefined : t("confirmHide")} testId={hidden ? "unhide-business" : "hide-business"}>
        {hidden ? t("unhide") : t("hide")}
      </BusinessActionButton>
    </form>
  );
}

/** Public / not public / hidden badge, using colours that already exist in the dashboard. */
export async function VisibilityBadge({ state }: { state: "public" | "notPublic" | "hidden" }) {
  const t = await getTranslations("businessVisibility");
  const tone = state === "public" ? "bg-[oklch(0.95_0.05_150)] text-[oklch(0.35_0.1_150)]" : state === "hidden" ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted";
  return <span data-testid="visibility" data-state={state} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{t(state)}</span>;
}
