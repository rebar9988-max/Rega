/**
 * Rega24Travel artwork (owner mockup 2026-11-18). Original inline vectors: no photograph, no third-party asset, no
 * network request. Decorative only — aria-hidden; the visible text carries the meaning.
 */

/** Line airplane with a swoosh trail, drawn in currentColor (hero title). */
export function PlaneSwoosh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 48" className={className} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 42c18 4 40-2 58-16" strokeWidth="2.6" />
      <path d="M78 6 54 26l-8-2-3 3 9 5 2 9 3-3-1-8 20-24c2-2 2-5 0-5-1-1-3 0-4 1Z" strokeWidth="2.4" fill="currentColor" fillOpacity=".15" />
      <path d="m62 14-16-4-4 3 13 8M70 22l4 16-3 3-7-12" strokeWidth="2.4" />
    </svg>
  );
}

/** Airport at sunset: sky glow, terminal with glass front, control tower, jet on the apron (travel hero). */
export function AirportArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d42a20" stopOpacity="0" />
          <stop offset=".55" stopColor="#e9662b" stopOpacity=".55" />
          <stop offset=".85" stopColor="#ffd27a" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffe07a" />
        </linearGradient>
        <linearGradient id="rt-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6db3ff" stopOpacity=".55" />
          <stop offset="1" stopColor="#1d2533" stopOpacity=".9" />
        </linearGradient>
        <linearGradient id="rt-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a1410" />
          <stop offset="1" stopColor="#1d0a07" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="400" height="104" fill="url(#rt-sky)" />
      <circle cx="210" cy="100" r="20" fill="#fff4c9" opacity=".75" />
      {/* control tower */}
      <path d="M262 100V52h10v48Z" fill="#2b1512" />
      <path d="M254 52h26l-4-12h-18Z" fill="#2b1512" />
      <path d="M257 44h20v-6h-20Z" fill="url(#rt-glass)" />
      <path d="M260 38h14l-2-6h-10Z" fill="#2b1512" />
      <rect x="266" y="26" width="2" height="6" fill="#2b1512" />
      {/* terminal: curved roof, glass front */}
      <path d="M60 100V80c40-14 120-16 180-6l40 8v18Z" fill="#2b1512" />
      <path d="M68 98V83c38-12 112-14 168-5l36 7v13Z" fill="url(#rt-glass)" />
      {Array.from({ length: 17 }, (_, i) => <path key={i} d={`M${78 + i * 12} 98V${82 - Math.sin((i / 16) * Math.PI) * 3}`} stroke="#2b1512" strokeWidth="1.4" />)}
      <path d="M286 100V86h52v14Z" fill="#2b1512" />
      <path d="M290 98v-9h44v9Z" fill="url(#rt-glass)" />
      {/* jet on the apron */}
      <g fill="#f4f1ef">
        <path d="M10 96c0-3 4-5 10-5h44l10-6h6l-6 7c4 0 6 2 6 4s-2 3-6 3H20c-6 0-10-1-10-3Z" />
        <path d="M34 95h20l-10 8h-6Z" />
        <path d="M70 92l8-10h4l-4 11Z" />
      </g>
      <path d="M18 93h40" stroke="#6db3ff" strokeWidth="1.4" strokeDasharray="2 2" />
      <rect x="0" y="100" width="400" height="20" fill="url(#rt-ground)" />
      <path d="M0 108h400" stroke="#ffe07a" strokeOpacity=".35" strokeWidth="1" strokeDasharray="10 8" />
    </svg>
  );
}

/** Red suitcase with a straw hat, a jet and a camera (home promotional card). */
export function SuitcaseArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 200" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rs-case" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6a5e" />
          <stop offset="1" stopColor="#a5121a" />
        </linearGradient>
        <linearGradient id="rs-hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dfae" />
          <stop offset="1" stopColor="#d9b06a" />
        </linearGradient>
        <linearGradient id="rs-plane" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9ced8" />
        </linearGradient>
        <linearGradient id="rs-cam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56627a" />
          <stop offset="1" stopColor="#1d2533" />
        </linearGradient>
      </defs>
      <ellipse cx="108" cy="188" rx="92" ry="8" fill="#2b0805" opacity=".28" />
      {/* soft clouds */}
      <ellipse cx="170" cy="150" rx="40" ry="14" fill="#fff" opacity=".22" />
      <ellipse cx="190" cy="140" rx="22" ry="12" fill="#fff" opacity=".18" />
      {/* suitcase */}
      <path d="M58 40V26a8 8 0 0 1 8-8h32a8 8 0 0 1 8 8v14" stroke="#7c0d12" strokeWidth="7" fill="none" strokeLinecap="round" />
      <rect x="30" y="38" width="104" height="138" rx="14" fill="url(#rs-case)" />
      <path d="M52 38v138M112 38v138" stroke="#8b0f16" strokeWidth="6" opacity=".55" />
      <rect x="38" y="46" width="12" height="80" rx="6" fill="#fff" opacity=".22" />
      <circle cx="46" cy="182" r="7" fill="#1d2533" />
      <circle cx="120" cy="182" r="7" fill="#1d2533" />
      {/* straw hat */}
      <ellipse cx="96" cy="44" rx="56" ry="15" fill="url(#rs-hat)" />
      <path d="M66 42c0-22 14-32 30-32s30 10 30 32c-10 5-50 5-60 0Z" fill="url(#rs-hat)" />
      <path d="M67 34c10 5 48 5 58 0l1 7c-10 5-50 5-60 0Z" fill="#2b1512" />
      {/* camera */}
      <rect x="112" y="150" width="58" height="36" rx="7" fill="url(#rs-cam)" />
      <rect x="124" y="143" width="18" height="9" rx="3" fill="#1d2533" />
      <circle cx="141" cy="168" r="12" fill="#c4cbd6" />
      <circle cx="141" cy="168" r="8" fill="#1d2533" />
      <circle cx="138" cy="165" r="2.5" fill="#fff" opacity=".7" />
      {/* jet */}
      <g transform="rotate(-12 150 92)">
        <path d="M84 96c0-4 6-7 14-7h86c8 0 18 3 18 7s-10 7-18 7H98c-8 0-14-3-14-7Z" fill="url(#rs-plane)" />
        <path d="M150 90 128 62h-10l14 28ZM150 102l-22 28h-10l14-28Z" fill="url(#rs-plane)" />
        <path d="M94 90 86 76h-6l4 16Z" fill="url(#rs-plane)" />
        <path d="M176 92h18c3 0 6 2 7 4h-25Z" fill="#6db3ff" opacity=".7" />
        {Array.from({ length: 7 }, (_, i) => <circle key={i} cx={110 + i * 9} cy="94" r="1.6" fill="#6db3ff" />)}
      </g>
    </svg>
  );
}
