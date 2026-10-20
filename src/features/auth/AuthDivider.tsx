/** "—— or ——" separator between the social buttons and the e-mail form (server- and client-safe, no hooks). */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div role="separator" aria-label={label} className="flex items-center gap-3 text-xs font-semibold text-muted">
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      <span aria-hidden="true">{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}
