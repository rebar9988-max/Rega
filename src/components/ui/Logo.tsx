/** Original owner-approved REGA24 artwork; full frame and proportions preserved. */
export function LogoMark({ className = "size-11" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/rega24-badge-96.webp" srcSet="/brand/rega24-badge-64.webp 64w, /brand/rega24-badge-96.webp 96w, /brand/rega24-badge-192.webp 192w, /brand/rega24-badge-384.webp 384w" sizes="48px" alt="" width={192} height={192} decoding="async" className={`${className} shrink-0 rounded-xl object-contain`} />
  );
}
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return <span className={`inline-flex items-center gap-2 ${className}`} dir="ltr">
    <LogoMark className={compact ? "size-8" : "size-11"} />
    <span className="flex flex-col leading-tight"><span lang="ckb" dir="rtl" className="text-[26px] font-bold text-brand-text">ڕێگا</span><span className="text-[11px] font-bold tracking-wide text-ink">REGA24</span></span>
  </span>;
}
