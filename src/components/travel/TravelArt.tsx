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
 * Clean route illustration for the compact banner (owner 2026-11-19 12:31: no cartoon art): globe outline, dashed
 * flight route between two pins and a plane, white line work on the brand red. Decorative only.
 */
export function TravelRouteArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="60" cy="60" r="56" fill="#fff" fillOpacity=".1" stroke="none" />
      <circle cx="60" cy="64" r="34" strokeOpacity=".55" strokeWidth="1.5" />
      <ellipse cx="60" cy="64" rx="14" ry="34" strokeOpacity=".4" strokeWidth="1.2" />
      <path d="M27 54h66M27 74h66" strokeOpacity=".4" strokeWidth="1.2" />
      <path d="M30 88C38 50 74 30 96 40" strokeWidth="2" strokeDasharray="1 6" />
      <path d="M30 80a6 6 0 0 1 6 6c0 4.5-6 10-6 10s-6-5.5-6-10a6 6 0 0 1 6-6Z" fill="#fff" stroke="none" />
      <circle cx="30" cy="86" r="2.2" fill="#d42a20" stroke="none" />
      <g transform="translate(84 26) rotate(28)">
        <path d="M11 1.5c1.2 0 2 1 2 2.3V10l8 4.6v2.6l-8-2.3v4.6l2.6 2v2l-4.6-1.3-4.6 1.3v-2l2.6-2v-4.6l-8 2.3v-2.6L9 10V3.8c0-1.3.8-2.3 2-2.3Z" fill="#fff" stroke="none" />
      </g>
    </svg>
  );
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * Service icons in the shared line style (24px grid, 1.75 stroke): plane, taxi, bus, car, truck, package.
 * Decorative; the label carries the meaning.
 */
export function TravelServiceIcon({ slug, className }: { slug: string; className?: string }) {
  const body: Record<string, ReactNode> = {
    "travel-agencies": <path {...STROKE} d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
    "taxi-transfer": <g {...STROKE}><path d="M10 2h4" /><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" /><path d="M7 14h.01M17 14h.01" /><rect width="18" height="8" x="3" y="10" rx="2" /><path d="M5 18v2M19 18v2" /></g>,
    "airport-transfer": <g {...STROKE}><path d="M8 6v6M15 6v6M2 12h19.6" /><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" /><circle cx="7" cy="18" r="2" /><path d="M9 18h5" /><circle cx="16" cy="18" r="2" /></g>,
    "car-rental": <g {...STROKE}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></g>,
    "cargo-logistics": <g {...STROKE}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></g>,
    "courier-delivery": <g {...STROKE}><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /><path d="M12 22V12" /><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" /><path d="m7.5 4.27 9 5.15" /></g>,
  };
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">{body[slug] ?? body["car-rental"]}</svg>;
}
