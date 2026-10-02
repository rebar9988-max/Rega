/** Business logo with an initials fallback; never layout-shifts (fixed box). */
export function Avatar({ name, src, size = "size-12" }: { name: string; src?: string | null; size?: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "•";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={96} height={96} loading="lazy" decoding="async" className={`${size} shrink-0 rounded-xl border border-line bg-surface object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${size} grid shrink-0 place-items-center rounded-xl bg-brand-soft text-lg font-bold text-brand`}>{initial}</span>
  );
}
