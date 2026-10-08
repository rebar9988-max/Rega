/**
 * Official REGA logo. The pin mark and the wordmark are the official artwork
 * (white 3D logo on the brand red) and are not redrawn or recolored.
 */
export function LogoMark({ className = "size-11" }: { className?: string }) {
  // Shown at 32–48 px: browsers take the 256px file (sharp up to 5x); the 512px file is kept for larger uses.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/rega-mark-512.webp" srcSet="/brand/rega-mark-256.webp 256w, /brand/rega-mark-512.webp 512w" sizes="48px" alt="" width={512} height={512} decoding="async" fetchPriority="high" className={`${className} shrink-0 rounded-xl`} />
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} dir="ltr">
      <span className="inline-flex shrink-0 items-center overflow-hidden rounded-xl bg-[#dc0201]">
        <LogoMark className="size-12 rounded-none" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/rega-wordmark.webp" alt="" width={640} height={147} decoding="async" className="h-5 w-auto max-w-none shrink-0 pe-3 sm:h-6" />
      </span>
      <span className="sr-only">REGA</span>
    </span>
  );
}
