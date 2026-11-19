/**
 * Rega24Travel artwork (owner mockup 2026-11-18). Original inline vectors: no photograph, no third-party asset, no
 * network request. Decorative only — aria-hidden; the visible text carries the meaning.
 */
import type { ReactNode } from "react";

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

/**
 * Premium banner scene (owner reference 2026-11-18 21:32): red suitcase with straw hat on a glowing platform, globe
 * with a location pin, taxi roof sign, white SUV, airport terminal with control tower and a departing jet.
 */
export function TravelSceneArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 260" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6db3ff" stopOpacity=".55" /><stop offset=".7" stopColor="#ffd9b0" stopOpacity=".6" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id="ts-case" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff5a4e" /><stop offset=".55" stopColor="#d42a20" /><stop offset="1" stopColor="#8b0f16" /></linearGradient>
        <linearGradient id="ts-hat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f8e3b4" /><stop offset="1" stopColor="#d6a85f" /></linearGradient>
        <linearGradient id="ts-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c3c9d4" /></linearGradient>
        <linearGradient id="ts-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd0ff" /><stop offset="1" stopColor="#2c5fa8" /></linearGradient>
        <radialGradient id="ts-globe" cx=".35" cy=".3" r=".75"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d9dde5" /></radialGradient>
        <linearGradient id="ts-gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffe07a" /><stop offset=".5" stopColor="#fff4c9" /><stop offset="1" stopColor="#e19a12" /></linearGradient>
        <linearGradient id="ts-taxi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe45c" /><stop offset="1" stopColor="#e7b300" /></linearGradient>
      </defs>
      {/* sky and airport */}
      <rect x="150" y="20" width="210" height="190" rx="24" fill="url(#ts-sky)" />
      <path d="M262 150v-58h12v58Z" fill="#dfe3ea" />
      <path d="M252 92h32l-5-14h-22Z" fill="#c3c9d4" />
      <path d="M255 84h26v-10h-26Z" fill="url(#ts-glass)" />
      <path d="M200 170v-26c40-10 90-10 150-2v28Z" fill="#e9edf3" />
      <path d="M206 168v-20c38-8 84-8 138-2v22Z" fill="url(#ts-glass)" opacity=".9" />
      {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${218 + i * 13} 168v-21`} stroke="#e9edf3" strokeWidth="1.6" />)}
      {/* departing jet */}
      <g transform="translate(250 30) rotate(-14)">
        <path d="M0 14c0-4 6-7 14-7h68c8 0 14 3 14 7s-6 7-14 7H14C6 21 0 18 0 14Z" fill="url(#ts-metal)" />
        <path d="M46 9 30-12h-8l10 21ZM46 19 30 40h-8l10-21ZM8 9 2-3H-3l3 14Z" fill="url(#ts-metal)" />
        <path d="M78 10h12c3 0 5 2 6 4H78Z" fill="#2c5fa8" opacity=".8" />
      </g>
      {/* glowing platform ring */}
      <ellipse cx="190" cy="222" rx="160" ry="26" fill="#2b0805" opacity=".22" />
      <ellipse cx="190" cy="214" rx="156" ry="24" fill="none" stroke="url(#ts-gold)" strokeWidth="5" />
      <ellipse cx="190" cy="214" rx="146" ry="19" fill="#d42a20" />
      <ellipse cx="190" cy="211" rx="146" ry="16" fill="#e53832" />
      {/* globe with pin */}
      <circle cx="78" cy="168" r="44" fill="url(#ts-globe)" />
      <path d="M50 146c8-6 18-4 22 2s14 4 16 12-8 12-6 20-10 10-16 4-14-6-14-16 4-12-2-22Zm46-14c8 2 14 8 16 16-6 0-10-4-14-2s-6-8-2-14Zm4 52c6-2 10 2 10 8s-6 10-10 6 0-10 0-14Z" fill="#d42a20" opacity=".9" />
      <path d="M78 96a20 20 0 0 1 20 20c0 15-20 34-20 34s-20-19-20-34a20 20 0 0 1 20-20Z" fill="url(#ts-case)" stroke="#fff" strokeWidth="2.5" />
      <circle cx="78" cy="116" r="7.5" fill="#fff" />
      {/* suitcase */}
      <path d="M148 46V22a6 6 0 0 1 6-6h30a6 6 0 0 1 6 6v24" stroke="#c3c9d4" strokeWidth="6" fill="none" />
      <rect x="122" y="44" width="96" height="150" rx="16" fill="url(#ts-case)" />
      {[140, 158, 176, 194].map((x) => <path key={x} d={`M${x} 50v138`} stroke="#8b0f16" strokeWidth="3" opacity=".45" />)}
      <rect x="128" y="52" width="10" height="110" rx="5" fill="#fff" opacity=".22" />
      <circle cx="136" cy="200" r="6" fill="#1d2533" /><circle cx="206" cy="200" r="6" fill="#1d2533" />
      {/* straw hat */}
      <g transform="rotate(-16 150 52)">
        <ellipse cx="150" cy="56" rx="54" ry="14" fill="url(#ts-hat)" />
        <path d="M122 54c0-22 12-32 28-32s28 10 28 32c-10 5-46 5-56 0Z" fill="url(#ts-hat)" />
        <path d="M123 46c10 5 44 5 54 0l1 7c-10 5-46 5-56 0Z" fill="#1d2533" />
      </g>
      {/* white SUV */}
      <g transform="translate(206 150)">
        <path d="M4 44V30c0-6 4-9 10-10l18-14c4-3 8-4 14-4h40c6 0 10 2 14 6l12 12c8 1 14 4 14 10v14Z" fill="url(#ts-metal)" />
        <path d="M36 10h22v14H22Zm28 0h22l12 14H64Z" fill="#2c3a52" />
        <path d="M118 30h10M4 34h12" stroke="#ff9d3a" strokeWidth="4" strokeLinecap="round" />
        <circle cx="32" cy="46" r="12" fill="#1d2533" /><circle cx="32" cy="46" r="5" fill="#c3c9d4" />
        <circle cx="106" cy="46" r="12" fill="#1d2533" /><circle cx="106" cy="46" r="5" fill="#c3c9d4" />
      </g>
      {/* taxi roof sign */}
      <g transform="translate(120 188)">
        <path d="M6 30 14 6h56l8 24Z" fill="url(#ts-taxi)" />
        <rect x="0" y="28" width="84" height="8" rx="3" fill="#1d2533" />
        <text x="42" y="24" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15" fill="#1d2533">TAXI</text>
      </g>
    </svg>
  );
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Red line icons of the six Rega24Travel service shortcuts (decorative; the label carries the meaning). */
export function TravelServiceIcon({ slug, className }: { slug: string; className?: string }) {
  const body: Record<string, ReactNode> = {
    "travel-agencies": <path {...STROKE} fill="currentColor" d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />,
    "taxi-transfer": <g {...STROKE}><path d="M9 4h6l1 3M5 17h14v-4l-2-5H7l-2 5Z" /><path d="M10 4V2.5h4V4" /><circle cx="8" cy="17.5" r="1.8" /><circle cx="16" cy="17.5" r="1.8" /><path d="M5 13h14" /></g>,
    "airport-transfer": <g {...STROKE}><path d="M3 16V8c0-1 1-2 2-2h11l5 5v5Z" /><path d="M3 11h18M8 6v5M13 6v5" /><circle cx="7" cy="17" r="1.8" /><circle cx="17" cy="17" r="1.8" /></g>,
    "car-rental": <g {...STROKE}><path d="M4 16v-3l2-5h12l2 5v3Z" /><path d="M4 13h16" /><circle cx="8" cy="16.5" r="1.8" /><circle cx="16" cy="16.5" r="1.8" /></g>,
    "cargo-logistics": <g {...STROKE}><rect x="2" y="6" width="20" height="10" rx="2" /><path d="M2 11h20M6 6v5M10 6v5M14 6v5M18 6v5" /><circle cx="6" cy="17" r="1.6" /><circle cx="18" cy="17" r="1.6" /></g>,
    "courier-delivery": <g {...STROKE}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></g>,
  };
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">{body[slug] ?? body["car-rental"]}</svg>;
}
