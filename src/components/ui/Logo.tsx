/** Original owner-approved REGA24 artwork; full frame and proportions preserved. */
export function LogoMark({ className = "size-11" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/rega24-badge-96.webp" srcSet="/brand/rega24-badge-64.webp 64w, /brand/rega24-badge-96.webp 96w, /brand/rega24-badge-192.webp 192w, /brand/rega24-badge-384.webp 384w" sizes="48px" alt="" width={192} height={192} decoding="async" className={`${className} shrink-0 rounded-xl object-contain`} />
  );
}
/** `inverse`: white wordmark on the logo-red header. */
export function Logo({ className = "", compact = false, inverse = false }: { className?: string; compact?: boolean; inverse?: boolean }) {
  return <span className={`inline-flex items-center gap-2 ${className}`} dir="ltr">
    <LogoMark className={`${compact ? "size-8" : "size-11"} ${inverse ? "shadow-[0_0_0_1.5px_rgb(255_255_255/.85)]" : ""}`} />
    <span className="flex flex-col leading-tight"><span lang="ckb" dir="rtl" className={`text-[26px] font-bold ${inverse ? "text-white" : "text-brand-text"}`}>ڕێگا</span><span className={`text-[11px] font-bold tracking-wide ${inverse ? "text-white" : "text-ink"}`}>REGA24</span></span>
  </span>;
}

/** Horizontal header lockup from the official master's complete silver mark and wordmark. */
export function HeaderLogo() {
  return <span className="rega-header-lockup" aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/brand/rega24-header-symbol-240.webp" srcSet="/brand/rega24-header-symbol-240.webp 240w, /brand/rega24-header-symbol-480.webp 480w" sizes="(min-width: 768px) 15vw, 58px" alt="" width={240} height={300} decoding="async" fetchPriority="high" className="rega-header-symbol" />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/brand/rega24-header-wordmark-480.webp" srcSet="/brand/rega24-header-wordmark-240.webp 240w, /brand/rega24-header-wordmark-480.webp 480w, /brand/rega24-header-wordmark-805.webp 805w" sizes="(min-width: 768px) 32vw, 160px" alt="" width={805} height={195} decoding="async" className="rega-header-wordmark" />
  </span>;
}
