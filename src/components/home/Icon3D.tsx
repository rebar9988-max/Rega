/**
 * Soft-3D category icons for the home page (owner reference 2026-11-14, Figma file 5h9pkPCkGHznr4z0JApqVT).
 * Original inline vector artwork: no photograph, no third-party asset, no network request. Decorative only —
 * every SVG is aria-hidden; the visible label next to it carries the meaning.
 * Gradients come from one shared palette; an icon only emits the gradients it uses. Identical ids on one page
 * always carry identical definitions, so repeating an icon is safe.
 */
import type { ReactNode } from "react";

const PALETTE: Record<string, [string, string]> = {
  red: ["#ff6a5e", "#c4161c"],
  gold: ["#ffe07a", "#e19a12"],
  blue: ["#6db3ff", "#1f5fd6"],
  silver: ["#ffffff", "#b4bac6"],
  steel: ["#dfe3ea", "#8f97a6"],
  purple: ["#a98bff", "#6236d8"],
  green: ["#7fe09a", "#259150"],
  dark: ["#56627a", "#1d2533"],
  white: ["#ffffff", "#e4e7ee"],
  sky: ["#d6eeff", "#7dbcff"],
  wood: ["#d99a5b", "#a5632a"],
};
const g = (name: string) => `url(#i3-${name})`;

type Icon = { use: string[]; body: ReactNode };

const ICONS: Record<string, Icon> = {
  legal: {
    use: ["gold", "blue"],
    body: <>
      <rect x="12" y="44" width="40" height="11" rx="3" fill={g("blue")} />
      <rect x="12" y="42" width="40" height="5" rx="2.5" fill="#3b7de8" />
      <rect x="15" y="48.5" width="34" height="3.5" rx="1.5" fill="#fff" opacity=".9" />
      <path d="M16 19 11 31M16 19l5 12M48 19l-5 12M48 19l5 12" stroke="#d8961a" strokeWidth="1" fill="none" />
      <rect x="30.5" y="12" width="3" height="29" rx="1.5" fill={g("gold")} />
      <rect x="24" y="39" width="16" height="4" rx="2" fill={g("gold")} />
      <rect x="12" y="16" width="40" height="3" rx="1.5" fill={g("gold")} />
      <circle cx="32" cy="12" r="3.2" fill={g("gold")} />
      <path d="M9 31h14a7 7 0 0 1-14 0ZM41 31h14a7 7 0 0 1-14 0Z" fill={g("gold")} />
    </>,
  },
  food: {
    use: ["steel", "red"],
    body: <>
      <rect x="19" y="26" width="5" height="30" rx="2.5" fill={g("steel")} />
      <path d="M13 9.7a1.7 1.7 0 0 1 3.4 0V19h3.4V9.7a1.7 1.7 0 0 1 3.4 0V19h3.4V9.7a1.7 1.7 0 0 1 3.4 0V21a8.5 8.5 0 0 1-17 0Z" fill={g("steel")} />
      <path d="M40 8c7 2 10 10 10 20v9H40Z" fill={g("red")} />
      <rect x="40" y="35" width="6.5" height="21" rx="3.2" fill="#b3141a" />
      <path d="M43 13c3 3 4.5 8 4.5 15" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".4" fill="none" />
    </>,
  },
  health: {
    use: ["red", "silver"],
    body: <>
      <path d="M32 54C14 42 8 32 8 23a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 9-6 19-24 31Z" fill={g("red")} />
      <ellipse cx="20" cy="19" rx="6.5" ry="3.8" fill="#fff" opacity=".3" transform="rotate(-28 20 19)" />
      <path d="M15 30h9l3-6 5 14 4-10 2.5 2H50" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="48" r="8" fill={g("silver")} />
      <path d="M14 44v8M10 48h8" stroke="#aab1bf" strokeWidth="2.6" strokeLinecap="round" />
    </>,
  },
  admin: {
    use: ["gold", "white", "steel", "blue"],
    body: <>
      <rect x="10" y="10" width="36" height="46" rx="5" fill={g("gold")} />
      <rect x="14" y="15" width="28" height="37" rx="2.5" fill={g("white")} />
      <rect x="22" y="6" width="12" height="8" rx="3" fill={g("steel")} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25.5 24h11M25.5 33h11M25.5 42h8" stroke="#c3c8d2" strokeWidth="2.4" />
        <path d="m17.6 24 1.6 1.6 2.8-3.2M17.6 33l1.6 1.6 2.8-3.2M17.6 42l1.6 1.6 2.8-3.2" stroke="#e0352f" strokeWidth="1.8" />
      </g>
      <g transform="rotate(32 48 34)">
        <rect x="45" y="14" width="7" height="30" rx="2.5" fill={g("blue")} />
        <rect x="45" y="14" width="7" height="6" rx="2.5" fill="#1b4fb8" />
        <path d="M45 44h7l-3.5 7Z" fill="#f3c98b" />
      </g>
    </>,
  },
  translation: {
    use: ["blue", "red"],
    body: <>
      <rect x="6" y="8" width="30" height="30" rx="7" fill={g("blue")} />
      <path d="M26 15c2.5 6 0 12-10.5 13M17.5 32l2.3 2.3 2.3-2.3" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="28" y="26" width="30" height="30" rx="7" fill={g("red")} />
      <path d="m36 50 7-17 7 17M38.8 44.5h8.4" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M42 10c6 0 10 3 11 8.5M49.6 14.6l3.4 4.4 3.2-4.6M22 54c-6 0-10-3-11-8.5M14.4 49.4 11 45l-3.2 4.6" stroke="#8f97a6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>,
  },
  "beauty-barber": {
    use: ["steel", "white"],
    body: <>
      <path d="M10 8 27 33l-4 3ZM36 8 19 33l4 3Z" fill={g("steel")} />
      <path d="m21.5 35-5 5.5M24.5 35l5 5.5" stroke="#d92a26" strokeWidth="4" strokeLinecap="round" />
      <circle cx="14" cy="46" r="6.5" fill="none" stroke="#d92a26" strokeWidth="4" />
      <circle cx="32" cy="46" r="6.5" fill="none" stroke="#d92a26" strokeWidth="4" />
      <circle cx="23" cy="33" r="1.8" fill="#6f7888" />
      <rect x="45" y="10" width="10" height="40" rx="5" fill={g("white")} />
      <path d="m45 20 10-6v5l-10 6ZM45 40l10-6v5l-10 6Z" fill="#e0352f" />
      <path d="m45 30 10-6v5l-10 6Z" fill="#2f6fe0" />
      <rect x="44" y="7" width="12" height="5" rx="2.5" fill={g("steel")} />
      <rect x="44" y="48" width="12" height="5" rx="2.5" fill={g("steel")} />
    </>,
  },
  "auto-garage": {
    use: ["red", "sky", "dark", "silver"],
    body: <>
      <path d="M5 40c0-4 2-6 6-7l6-9c1.5-2 3.2-3 6-3h14c3 0 5 1 7 3l7 8c5 1 8 3 8 7v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z" fill={g("red")} />
      <path d="M22 25.5h8.5V33H15.8l3.6-5.8c.6-1 1.4-1.7 2.6-1.7ZM33.5 25.5H38c1.5 0 2.6.5 3.6 1.7L46.5 33h-13Z" fill={g("sky")} />
      <path d="M9 38.5h46" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".3" />
      <rect x="53.5" y="36.5" width="4.5" height="3" rx="1.5" fill="#ffe07a" />
      <circle cx="19" cy="46" r="6.5" fill={g("dark")} />
      <circle cx="19" cy="46" r="2.8" fill={g("silver")} />
      <circle cx="45" cy="46" r="6.5" fill={g("dark")} />
      <circle cx="45" cy="46" r="2.8" fill={g("silver")} />
    </>,
  },
  "construction-crafts": {
    use: ["gold"],
    body: <>
      <path d="M10 45a22 22 0 0 1 44 0Z" fill={g("gold")} />
      <rect x="28.5" y="21" width="7" height="24" rx="3.5" fill="#fff" opacity=".45" />
      <rect x="6" y="43" width="52" height="8" rx="4" fill="#e19a12" />
      <rect x="6" y="43" width="52" height="3.5" rx="1.75" fill="#ffd257" />
    </>,
  },
  education: {
    use: ["dark", "gold"],
    body: <>
      <path d="M16 31v11c0 4 7 8 16 8s16-4 16-8V31l-16 7Z" fill="#2a3446" />
      <path d="M32 13 60 25.5 32 38 4 25.5Z" fill={g("dark")} />
      <path d="M32 16.5 49 24" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".25" />
      <path d="M54 28v13" stroke="#e19a12" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="54" cy="44" r="3.4" fill={g("gold")} />
    </>,
  },
  "real-estate": {
    use: ["white", "red", "sky"],
    body: <>
      <rect x="44" y="12" width="6" height="12" rx="1.5" fill="#b3141a" />
      <rect x="14" y="29" width="36" height="27" rx="3" fill={g("white")} />
      <path d="M32 9 57 31c1.6 1.5.6 4-1.6 4H8.6c-2.2 0-3.2-2.5-1.6-4Z" fill={g("red")} />
      <rect x="27" y="41" width="10" height="15" rx="2" fill={g("red")} />
      <rect x="18" y="40" width="6" height="6" rx="1.2" fill={g("sky")} />
      <rect x="40" y="40" width="6" height="6" rx="1.2" fill={g("sky")} />
    </>,
  },
  "travel-tickets": {
    use: ["blue", "silver"],
    body: <>
      <circle cx="32" cy="31" r="24" fill={g("blue")} />
      <ellipse cx="23" cy="17" rx="10" ry="5" fill="#fff" opacity=".22" transform="rotate(-25 23 17)" />
      <path transform="translate(8.5 6.5) scale(1.95)" d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" fill={g("silver")} />
    </>,
  },
  "groceries-markets": {
    use: ["red", "green", "gold"],
    body: <>
      <path d="M41 5c5.5 2.5 7.5 9 5.5 18h-10c-2-9 0-15 4.5-18Z" fill={g("green")} />
      <circle cx="25" cy="19" r="8" fill={g("red")} />
      <path d="M25 12c.8-4 3.6-5.5 7-5.5-.8 3.3-3 5.5-7 5.5Z" fill="#259150" />
      <path d="M13 24h38l-3 29.5a3 3 0 0 1-3 2.7H19a3 3 0 0 1-3-2.7Z" fill={g("gold")} />
      <rect x="13" y="24" width="38" height="4.5" rx="2" fill="#ffe89a" />
      <rect x="24" y="36" width="16" height="9" rx="2.5" fill="#fff" opacity=".55" />
    </>,
  },
  "it-phones": {
    use: ["dark", "blue"],
    body: <>
      <rect x="18" y="5" width="28" height="53" rx="6.5" fill={g("dark")} />
      <rect x="21" y="9" width="22" height="41" rx="3" fill={g("blue")} />
      <path d="M21 12a3 3 0 0 1 3-3h10L21 30Z" fill="#fff" opacity=".16" />
      <rect x="25" y="16" width="6" height="6" rx="1.6" fill="#fff" opacity=".92" />
      <rect x="33" y="16" width="6" height="6" rx="1.6" fill="#ffe07a" />
      <rect x="25" y="24" width="6" height="6" rx="1.6" fill="#ff6a5e" />
      <rect x="33" y="24" width="6" height="6" rx="1.6" fill="#7fe09a" />
      <circle cx="32" cy="54" r="1.8" fill="#8f97a6" />
    </>,
  },
  "tax-accounting": {
    use: ["white", "dark", "steel", "red", "gold"],
    body: <>
      <rect x="12" y="6" width="36" height="52" rx="6" fill={g("white")} stroke="#cfd4dd" strokeWidth="1" />
      <rect x="17" y="11" width="26" height="11" rx="2.5" fill={g("dark")} />
      {[27, 36, 45].flatMap((y) => [17, 26.5].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="2" fill={g("steel")} />))}
      <rect x="36" y="27" width="7" height="7" rx="2" fill={g("red")} />
      <rect x="36" y="36" width="7" height="16" rx="2" fill={g("red")} />
      <circle cx="50" cy="47" r="9" fill={g("gold")} />
      <circle cx="50" cy="47" r="5.5" fill="none" stroke="#c98510" strokeWidth="1.4" />
    </>,
  },
  "driving-schools": {
    use: ["dark", "red"],
    body: <>
      <path d="M32 32 12 27M32 32l20-5M32 32v22" stroke="#2a3446" strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="32" r="22" fill="none" stroke={g("dark")} strokeWidth="7" />
      <path d="M15 22a20 20 0 0 1 20-9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".28" fill="none" />
      <circle cx="32" cy="32" r="7.5" fill={g("red")} />
    </>,
  },
  cleaning: {
    use: ["blue", "steel", "red", "gold"],
    body: <>
      <path d="M20 28h22l3 26a3 3 0 0 1-3 3.3H20a3 3 0 0 1-3-3.3Z" fill={g("blue")} />
      <rect x="26" y="19" width="10" height="10" rx="2" fill={g("steel")} />
      <path d="M22 9h17a3 3 0 0 1 3 3v8H26v-4.5h-7.5l-3-3.2 3-3.3Z" fill={g("red")} />
      <rect x="24" y="38" width="14" height="10" rx="2.5" fill="#fff" opacity=".85" />
      <path d="m51 8 1.7 4.3L57 14l-4.3 1.7L51 20l-1.7-4.3L45 14l4.3-1.7ZM54 28l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1Z" fill={g("gold")} />
    </>,
  },
  "transport-moving": {
    use: ["white", "red", "sky", "dark", "silver"],
    body: <>
      <rect x="4" y="17" width="34" height="27" rx="3.5" fill={g("white")} stroke="#d5d9e1" strokeWidth="1" />
      <rect x="4" y="33" width="34" height="4.5" fill="#e0352f" />
      <path d="M38 25h10c2 0 3.2.8 4.2 2.2l6 8.4c.6.9.8 1.8.8 3V44H38Z" fill={g("red")} />
      <path d="M42 28.5h6l4.6 6.5H42Z" fill={g("sky")} />
      <rect x="4" y="42" width="55" height="3.5" rx="1.75" fill="#8f97a6" />
      <circle cx="16" cy="47" r="6.5" fill={g("dark")} />
      <circle cx="16" cy="47" r="2.8" fill={g("silver")} />
      <circle cx="47" cy="47" r="6.5" fill={g("dark")} />
      <circle cx="47" cy="47" r="2.8" fill={g("silver")} />
    </>,
  },
  insurance: {
    use: ["blue"],
    body: <>
      <path d="M32 6 54 14v16c0 13-9 22-22 28C19 52 10 43 10 30V14Z" fill={g("blue")} />
      <path d="M32 6v52C19 52 10 43 10 30V14Z" fill="#fff" opacity=".16" />
      <path d="m22 31 7 7 13-14" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>,
  },
  "community-associations": {
    use: ["blue", "gold", "red"],
    body: <>
      <circle cx="15" cy="25" r="6.5" fill={g("blue")} />
      <path d="M4 48a11 11 0 0 1 22 0v3H4Z" fill={g("blue")} />
      <circle cx="49" cy="25" r="6.5" fill={g("gold")} />
      <path d="M38 48a11 11 0 0 1 22 0v3H38Z" fill={g("gold")} />
      <circle cx="32" cy="21" r="8.5" fill={g("red")} />
      <path d="M15 54a17 17 0 0 1 34 0v2H15Z" fill={g("red")} />
    </>,
  },
  more: {
    use: ["purple"],
    body: <>
      <path d="M32 8c14 0 24 8.5 24 20S46 48 32 48c-2.6 0-5-.3-7.3-.9L14 54l2.4-10.3C11.2 39.9 8 34.3 8 28 8 16.5 18 8 32 8Z" fill={g("purple")} />
      <ellipse cx="24" cy="17" rx="9" ry="4" fill="#fff" opacity=".24" transform="rotate(-14 24 17)" />
      <circle cx="22" cy="28" r="3.4" fill="#fff" />
      <circle cx="32" cy="28" r="3.4" fill="#fff" />
      <circle cx="42" cy="28" r="3.4" fill="#fff" />
    </>,
  },
};

/** Slugs that have their own artwork; anything else falls back to the caller's line icon. */
export const hasIcon3D = (slug: string) => Object.prototype.hasOwnProperty.call(ICONS, slug);

function Defs({ use }: { use: string[] }) {
  return (
    <defs>
      {use.map((name) => {
        const [from, to] = PALETTE[name] ?? PALETTE.red;
        return (
          <linearGradient key={name} id={`i3-${name}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        );
      })}
    </defs>
  );
}

export function Icon3D({ name, className = "size-12" }: { name: string; className?: string }) {
  const icon = ICONS[name] ?? ICONS.more;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <Defs use={icon.use} />
      <ellipse cx="32" cy="58.5" rx="19" ry="3" fill="#2b0805" opacity=".12" />
      {icon.body}
    </svg>
  );
}

/** Empty-state illustration: a small shop with the REGA24 red awning and a location pin. */
export function StoreArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 170" className={className} aria-hidden="true" focusable="false">
      <Defs use={["red", "white", "sky", "green", "wood"]} />
      <ellipse cx="100" cy="156" rx="88" ry="8" fill="#2b0805" opacity=".1" />
      <rect x="30" y="60" width="140" height="92" rx="6" fill={g("white")} stroke="#dfe3ea" strokeWidth="1" />
      <rect x="24" y="42" width="152" height="24" rx="6" fill={g("red")} />
      <rect x="24" y="42" width="152" height="7" rx="3.5" fill="#fff" opacity=".22" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} d={`M${30 + i * 20} 66h20v16a10 10 0 0 1-20 0Z`} fill={i % 2 ? "#fff" : g("red")} stroke="#e7c9c9" strokeWidth=".6" />
      ))}
      <rect x="42" y="104" width="38" height="30" rx="3" fill={g("sky")} stroke="#b9c2cf" strokeWidth="1.5" />
      <rect x="120" y="104" width="38" height="30" rx="3" fill={g("sky")} stroke="#b9c2cf" strokeWidth="1.5" />
      <path d="M61 104v30M139 104v30" stroke="#b9c2cf" strokeWidth="1.5" />
      <rect x="87" y="102" width="26" height="50" rx="3" fill={g("wood")} />
      <rect x="91" y="107" width="18" height="24" rx="2" fill={g("sky")} />
      <circle cx="108" cy="137" r="1.8" fill="#ffe07a" />
      <rect x="18" y="142" width="18" height="12" rx="2.5" fill="#cfd4dd" />
      <circle cx="27" cy="132" r="13" fill={g("green")} />
      <rect x="164" y="142" width="18" height="12" rx="2.5" fill="#cfd4dd" />
      <circle cx="173" cy="132" r="13" fill={g("green")} />
      <path d="M150 2a17 17 0 0 1 17 17c0 12.5-17 27-17 27s-17-14.5-17-27a17 17 0 0 1 17-17Z" fill={g("red")} stroke="#fff" strokeWidth="2" />
      <circle cx="150" cy="19" r="6.5" fill="#fff" />
    </svg>
  );
}
