/**
 * Official REGA logo. The pin mark and the wordmark are cropped, unaltered, from the official brand artwork
 * (white 3D logo on the brand red field) and web-optimised (public/brand/*.webp). They sit on the same red as the
 * artwork, so the lockup reads as one piece. Nothing here redraws or recolours the logo.
 * Below `sm` only the pin is shown (space); the name stays available to assistive tech through the link's label.
 */
export function LogoMark({ className = "size-11" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/rega-mark-512.webp" alt="" width={512} height={512} decoding="async" fetchPriority="high" className={`${className} shrink-0 rounded-xl`} />
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} dir="ltr">
      <span className="inline-flex shrink-0 items-center overflow-hidden rounded-xl bg-[#dc0201]">
        <LogoMark className="size-11 rounded-none" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/rega-wordmark.webp" alt="" width={640} height={147} decoding="async" className="h-[1.15rem] w-auto max-w-none shrink-0 pe-2.5 sm:h-[1.4rem] sm:pe-3" />
      </span>
      <span className="sr-only">REGA Platform</span>
      <span aria-hidden="true" className="hidden whitespace-nowrap text-base font-semibold text-ink lg:inline">Platform</span>
    </span>
  );
}
