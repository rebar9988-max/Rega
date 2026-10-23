"use client";
import { useFormStatus } from "react-dom";
export function BusinessActionButton({
  children,
  className,
  confirmText,
  testId,
}: {
  children: React.ReactNode;
  className: string;
  /** Asks before submitting (e.g. hiding a listing); cancelling sends nothing. */
  confirmText?: string;
  testId?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-testid={testId}
      onClick={confirmText ? (event) => { if (!window.confirm(confirmText)) event.preventDefault(); } : undefined}
      className={`${className} disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
