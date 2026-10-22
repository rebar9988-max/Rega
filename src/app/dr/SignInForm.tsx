"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  CODE_IDLE,
  sendDashboardCode,
  verifyDashboardCode,
  type CodeFormState,
} from "./sign-in-actions";

// The same field, card and button classes the owner sign-in page already uses.
const field =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand";
const primary =
  "min-h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60";

function Submit({ intent, children }: { intent: "send" | "verify"; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="intent" value={intent} disabled={pending} aria-busy={pending} className={primary}>
      {children}
    </button>
  );
}

/** Ask for a fresh code from the code step; the server applies the 30-second cooldown. */
function Resend() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value="send"
      formNoValidate
      disabled={pending}
      className="min-h-11 w-full rounded-xl border border-line text-sm font-semibold hover:border-brand disabled:opacity-60"
    >
      ناردنەوەی کۆد
    </button>
  );
}

/**
 * Sign in to the dashboard with a code sent to the address on the account. The server decides
 * everything: this form only shows the two steps and whatever the server answered.
 */
export function SignInForm({ passwordHref }: { passwordHref: string }) {
  const [state, act] = useActionState<CodeFormState, FormData>(
    (prev, data) =>
      String(data.get("intent")) === "verify"
        ? verifyDashboardCode(prev, data)
        : sendDashboardCode(prev, data),
    CODE_IDLE,
  );
  const onCode = state.step === "code";

  return (
    <main data-dr-sign-in="" lang="ckb" dir="rtl" className="grid min-h-dvh place-items-center px-4 py-12">
      <section className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p dir="ltr" className="text-3xl font-black text-brand">
            REGA
          </p>
          <h1 className="mt-2 text-xl font-extrabold">چوونەژوورەوەی بەڕێوەبەر</h1>
          <p className="mt-1 text-sm text-muted">
            ئەو ئیمەیڵە بنووسە کە لەسەر هەژمارەکەتە. کۆدێکی شەش ژمارەیی بۆی دەنێرین.
          </p>
        </div>

        <form
          action={act}
          key={onCode ? "code" : "email"}
          className="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card"
        >
          {state.message ? (
            <p
              role={state.tone === "error" ? "alert" : "status"}
              className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold"
            >
              {state.message}
            </p>
          ) : null}

          <div>
            <label htmlFor="dr-email" className="mb-1 block text-sm font-semibold">
              ئیمەیڵ
            </label>
            <input
              id="dr-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              dir="ltr"
              readOnly={onCode}
              defaultValue={state.email}
              className={`${field} text-start`}
            />
          </div>

          {onCode ? (
            <div>
              <label htmlFor="dr-code" className="mb-1 block text-sm font-semibold">
                کۆدی شەش ژمارە
              </label>
              <input
                id="dr-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                dir="ltr"
                className={`${field} text-center text-2xl tracking-[0.4em]`}
              />
              <p className="mt-2 text-xs text-muted">
                کۆدەکە بۆ ٥ خولەک کار دەکات و تەنها یەک جار بەکاردێت.
              </p>
            </div>
          ) : null}

          <Submit intent={onCode ? "verify" : "send"}>
            {onCode ? "پشتڕاستکردنەوە و چوونەژوورەوە" : "ناردنی کۆدی پشتڕاستکردنەوە"}
          </Submit>
          {onCode ? <Resend /> : null}
        </form>

        <p className="mt-4 text-center text-sm">
          <a href={passwordHref} className="font-semibold text-brand hover:underline">
            چوونەژوورەوە بە وشەی نهێنی
          </a>
        </p>
      </section>
    </main>
  );
}
