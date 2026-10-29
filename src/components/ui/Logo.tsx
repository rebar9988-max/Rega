/**
 * Official REGA24 logo badge: the owner-supplied master artwork, resized only (scripts/generate-rega24-logo-assets.py).
 * The only logo component: header, footer, admin and auth pages all use it. It is a square badge in its own
 * container with a 1px border and the card shadow so it stays separate from light and dark page backgrounds.
 * `size` is the rendered size in px and is also written as width/height, so the badge never shifts the layout.
 * Pass `alt=""` when the badge is decorative (e.g. next to a heading); keep "REGA24" when it is the link's name.
 */
const SOURCES = [64, 96, 192, 384] as const;

export function LogoBadge({ size, alt = "REGA24", priority = false, className = "" }: { size: number; alt?: string; priority?: boolean; className?: string }) {
  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-lg border border-line shadow-card ${className}`} style={{ width: size, height: size }} dir="ltr">
      <picture>
        <source type="image/webp" srcSet={SOURCES.map((w) => `/brand/rega24-badge-${w}.webp ${w}w`).join(", ")} sizes={`${size}px`} />
        <img src="/brand/rega24-badge-192.png" alt={alt} width={size} height={size} decoding="async" fetchPriority={priority ? "high" : "auto"} loading={priority ? "eager" : "lazy"} className="block size-full" />
      </picture>
    </span>
  );
}
