"use client";

import { useFormStatus } from "react-dom";

/**
 * One social sign-in button. It submits the surrounding form to its own server action (`formAction`), skipping the form's
 * field validation (the e-mail fields next to it are not needed), and disables every button of the form while the
 * visitor is being sent to the provider so a double tap cannot start two sign-ins.
 */
export function SocialSubmit({ action, children }: { action: (formData: FormData) => void | Promise<void>; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={action}
      formNoValidate
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 text-base font-semibold text-ink transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
    >
      {children}
    </button>
  );
}
