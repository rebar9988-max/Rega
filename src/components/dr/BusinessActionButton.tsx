"use client";
import { useFormStatus } from "react-dom";
/** Submit button of a one-click dashboard action: disabled while its request runs, so a double tap sends it once. */
export function BusinessActionButton({
  children,
  className,
  testId,
}: {
  children: React.ReactNode;
  className: string;
  testId?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} data-testid={testId} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}
