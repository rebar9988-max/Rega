/** Workflow status of a dashboard record as a compact pill (dot + label). Colours are the dashboard's existing ones. */
const TONE: Record<string, { pill: string; dot: string }> = {
  published: { pill: "bg-[oklch(0.95_0.05_150)] text-[oklch(0.35_0.1_150)]", dot: "bg-[oklch(0.62_0.15_150)]" },
  pending: { pill: "bg-sun/20 text-ink", dot: "bg-sun" },
  draft: { pill: "bg-surface-2 text-ink/75", dot: "bg-muted/60" },
  archived: { pill: "bg-brand-soft text-brand", dot: "bg-brand/70" },
  deleted: { pill: "bg-surface-2 text-muted line-through decoration-muted/50", dot: "bg-muted/60" },
};

export function StatusPill({ status, label, testId = "row-status" }: { status: string; label: string; testId?: string }) {
  const tone = TONE[status] ?? TONE.draft;
  return (
    <span data-testid={testId} data-status={status} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone.pill}`}>
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />{label}
    </span>
  );
}
