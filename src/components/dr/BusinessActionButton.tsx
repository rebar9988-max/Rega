"use client";
import { useFormStatus } from "react-dom";
export function BusinessActionButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
