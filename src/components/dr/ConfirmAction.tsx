"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { DrIcon, type DrIconName } from "./icons";

/**
 * An action that asks first: the trigger opens a modal <dialog> (native focus trap, Escape cancels) that names the
 * record and the consequence. Only "Confirm" submits the server action; cancelling sends nothing. The confirm button
 * is disabled while the request runs, so a double tap cannot send it twice. Every rule is enforced by the action.
 */
export function ConfirmAction({ action, fields, trigger, triggerClassName, triggerTestId, icon, title, body, confirmLabel, cancelLabel, tone = "neutral" }: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  trigger: string;
  triggerClassName: string;
  triggerTestId?: string;
  icon?: DrIconName;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "danger" | "neutral";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" data-menu-close data-testid={triggerTestId} className={triggerClassName} onClick={() => ref.current?.showModal()}>
        {icon && <DrIcon name={icon} className="size-4" />}{trigger}
      </button>
      {mounted && createPortal(
        <dialog ref={ref} aria-labelledby={titleId} data-testid="confirm-dialog" data-tone={tone}
          className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
          onClick={(e) => { if (e.target === ref.current) close(); }}>
          <form action={action} className="p-5 sm:p-6">
            {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <div className="flex gap-4">
              <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full ${tone === "danger" ? "bg-brand-soft text-brand-text" : "bg-surface-2 text-ink"}`}>
                <DrIcon name={icon ?? "alert"} className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-bold">{title}</h2>
                <div className="mt-1.5 text-sm leading-relaxed text-muted">{body}</div>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" autoFocus onClick={close} data-testid="confirm-cancel"
                className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">{cancelLabel}</button>
              <ConfirmButton tone={tone} onDone={close}>{confirmLabel}</ConfirmButton>
            </div>
          </form>
        </dialog>,
        document.body,
      )}
    </>
  );
}

/** Stays disabled while the action runs (no second request), then closes the dialog. */
function ConfirmButton({ tone, onDone, children }: { tone: "danger" | "neutral"; onDone: () => void; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const ran = useRef(false);
  useEffect(() => {
    if (pending) ran.current = true;
    else if (ran.current) { ran.current = false; onDone(); }
  }, [pending, onDone]);
  return (
    <button type="submit" disabled={pending} aria-busy={pending} data-testid="confirm-submit"
      className={`min-h-11 rounded-xl px-4 text-sm font-bold transition disabled:opacity-60 ${tone === "danger" ? "bg-brand text-brand-ink hover:bg-brand-hover" : "bg-ink text-surface hover:bg-ink/85"}`}>
      {children}
    </button>
  );
}
