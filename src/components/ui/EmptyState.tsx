import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div role="status" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-6 py-14 text-center">
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      {body && <p className="text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
