/**
 * Decorative artwork of the approved REGA24 home reference (owner image, 2026-10-30), drawn as inline SVG: no photo,
 * no network request, no real landmark (globally neutral: generic skyline, globe, red connection lines).
 * Every piece is aria-hidden. Ids are prefixed "rh" and each graphic is rendered once per page.
 */

const deg = Math.PI / 180;
const GX = 700, GY = 250, GR = 190;

/** Latitude ellipses and meridians of the globe (computed once, plain numbers in the markup). */
const latitudes = [-60, -35, -12, 12, 35, 60].map((lat) => ({ cy: GY - GR * Math.sin(lat * deg), rx: GR * Math.cos(lat * deg), ry: 26 * Math.cos(lat * deg) }));
const meridians = [22, 48, 72].map((lon) => GR * Math.sin(lon * deg));

/** Skyline silhouettes: [x, width, height, roof] — roof: "flat" | "spire" | "dome" | "minaret" | "step". */
type Roof = "flat" | "spire" | "dome" | "minaret" | "step";
const BACK: [number, number, number, Roof][] = [
  [250, 34, 120, "flat"], [290, 26, 165, "spire"], [322, 40, 140, "step"], [370, 30, 190, "flat"], [406, 48, 150, "dome"],
  [460, 22, 210, "minaret"], [490, 44, 175, "flat"], [540, 36, 230, "spire"], [582, 52, 160, "step"], [640, 30, 200, "flat"],
  [676, 46, 245, "spire"], [728, 38, 180, "flat"], [772, 54, 150, "dome"], [832, 28, 215, "minaret"], [866, 44, 190, "step"], [916, 44, 170, "flat"],
];
const FRONT: [number, number, number, Roof][] = [
  [230, 46, 70, "flat"], [282, 34, 96, "step"], [322, 58, 82, "dome"], [386, 30, 120, "flat"], [422, 44, 104, "spire"],
  [472, 62, 90, "flat"], [540, 32, 132, "step"], [578, 50, 100, "flat"], [634, 26, 150, "minaret"], [666, 58, 112, "dome"],
  [730, 40, 128, "flat"], [776, 52, 96, "step"], [834, 36, 140, "spire"], [876, 84, 104, "flat"],
];

function building([x, w, h, roof]: [number, number, number, Roof], base: number): string {
  const top = base - h;
  const body = `M${x} ${base}V${top}H${x + w}V${base}Z`;
  const cx = x + w / 2;
  switch (roof) {
    case "spire": return `${body}M${x + w * 0.2} ${top}L${cx} ${top - h * 0.28}L${x + w * 0.8} ${top}Z`;
    case "dome": return `${body}M${x} ${top}A${w / 2} ${w / 2.2} 0 0 1 ${x + w} ${top}Z`;
    case "minaret": return `${body}M${cx - 3} ${top}V${top - h * 0.35}H${cx + 3}V${top}ZM${cx} ${top - h * 0.35 - 7}a5 5 0 1 0 .01 0Z`;
    case "step": return `${body}M${x + w * 0.18} ${top}V${top - 16}H${x + w * 0.82}V${top}Z`;
    default: return body;
  }
}

const sized = ([x, w, h, r]: [number, number, number, Roof], k: number): [number, number, number, Roof] => [x, w, Math.round(h * k), r];
const backPath = BACK.map((b) => building(sized(b, 0.78), 560)).join("");
const frontPath = FRONT.map((b) => building(sized(b, 0.82), 560)).join("");

/** Points on the globe (approximate places: Americas, Europe, Kurdistan/Iraq, Gulf, Asia). */
const PINS: [number, number][] = [[618, 196], [676, 150], [742, 214], [806, 262], [700, 300]];
const ARCS: [number, number, number, number, number, number][] = [
  [618, 196, 640, 120, 676, 150], [676, 150, 720, 150, 742, 214], [742, 214, 790, 214, 806, 262], [618, 196, 640, 290, 700, 300], [700, 300, 770, 320, 806, 262],
];

function Pin({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="2" rx="9" ry="3" fill="#000" opacity=".35" />
      <path d="M0 0C-7-9-14-15-14-24a14 14 0 0 1 28 0C14-15 7-9 0 0Z" fill="#e11220" stroke="#ff6b74" strokeWidth="1" />
      <circle cx="0" cy="-24" r="5.5" fill="#fff" />
    </g>
  );
}

export function HomeHeroArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 960 560" preserveAspectRatio="xMaxYMax slice" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rhSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1430" />
          <stop offset=".42" stopColor="#1c1b40" />
          <stop offset=".7" stopColor="#4e1430" />
          <stop offset=".88" stopColor="#a8172c" />
          <stop offset="1" stopColor="#e2452f" />
        </linearGradient>
        <radialGradient id="rhHorizon" cx=".62" cy="1" r=".6">
          <stop offset="0" stopColor="#ff8a5c" stopOpacity=".75" />
          <stop offset=".55" stopColor="#ff3b3b" stopOpacity=".18" />
          <stop offset="1" stopColor="#ff3b3b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rhGlobe" cx=".36" cy=".3" r=".85">
          <stop offset="0" stopColor="#3f7bd1" />
          <stop offset=".38" stopColor="#173a73" />
          <stop offset=".8" stopColor="#081631" />
          <stop offset="1" stopColor="#040a18" />
        </radialGradient>
        <radialGradient id="rhAtmos" cx=".5" cy=".5" r=".5">
          <stop offset=".86" stopColor="#7fb2ff" stopOpacity="0" />
          <stop offset=".94" stopColor="#9cc3ff" stopOpacity=".38" />
          <stop offset="1" stopColor="#9cc3ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rhBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b1028" />
          <stop offset="1" stopColor="#1d0914" />
        </linearGradient>
        <pattern id="rhWin" width="12" height="17" patternUnits="userSpaceOnUse">
          <rect x="4" y="5" width="2.4" height="3.4" fill="#ffcf8a" opacity=".38" />
        </pattern>
        <linearGradient id="rhFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a0b17" />
          <stop offset="1" stopColor="#10050a" />
        </linearGradient>
        <clipPath id="rhGlobeClip"><circle cx={GX} cy={GY} r={GR} /></clipPath>
        <filter id="rhSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>

      <rect width="960" height="560" fill="url(#rhSky)" />
      <rect width="960" height="560" fill="url(#rhHorizon)" />
      <g fill="#fff">
        {[[520, 40, .7], [590, 88, .45], [880, 60, .6], [930, 140, .4], [470, 120, .35], [840, 20, .5], [560, 170, .3], [910, 230, .35]].map(([x, y, o]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" opacity={o} />
        ))}
      </g>

      {/* Globe */}
      <circle cx={GX} cy={GY} r={GR + 22} fill="url(#rhAtmos)" />
      <circle cx={GX} cy={GY} r={GR} fill="url(#rhGlobe)" />
      <g clipPath="url(#rhGlobeClip)" fill="none" stroke="#9cc3ff" strokeOpacity=".22" strokeWidth="1">
        {latitudes.map((l) => <ellipse key={l.cy} cx={GX} cy={l.cy} rx={l.rx} ry={l.ry} />)}
        <ellipse cx={GX} cy={GY} rx={GR} ry="30" />
        <path d={`M${GX} ${GY - GR}V${GY + GR}`} />
        {meridians.map((rx) => <ellipse key={rx} cx={GX} cy={GY} rx={rx} ry={GR} />)}
        {/* City lights */}
        <g fill="#ffd9a0" stroke="none" opacity=".75">
          {[[640, 180], [660, 170], [690, 160], [710, 182], [735, 205], [752, 222], [770, 236], [600, 230], [628, 248], [690, 262], [722, 280], [790, 290], [812, 250], [668, 214]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />
          ))}
        </g>
      </g>
      <circle cx={GX} cy={GY} r={GR} fill="none" stroke="#cfe0ff" strokeOpacity=".28" strokeWidth="1.5" />

      {/* Connection lines */}
      <g fill="none" strokeLinecap="round">
        {ARCS.map(([x1, y1, cx, cy, x2, y2]) => (
          <g key={`${x1}-${y1}-${x2}`}>
            <path d={`M${x1} ${y1 - 24}Q${cx} ${cy - 30} ${x2} ${y2 - 24}`} stroke="#ff2a3a" strokeWidth="6" opacity=".35" filter="url(#rhSoft)" />
            <path d={`M${x1} ${y1 - 24}Q${cx} ${cy - 30} ${x2} ${y2 - 24}`} stroke="#ff4652" strokeWidth="1.8" strokeDasharray="1 0" />
          </g>
        ))}
      </g>
      {PINS.map(([x, y], i) => <Pin key={`${x}-${y}`} x={x} y={y} scale={i === 2 ? 1.25 : 0.9} />)}

      {/* Skyline */}
      <path d={backPath} fill="url(#rhBack)" opacity=".92" />
      <path d={frontPath} fill="url(#rhFront)" />
      <path d={frontPath} fill="url(#rhWin)" />
      <rect y="530" width="960" height="30" fill="#10050a" />
    </svg>
  );
}

/** Red light lines along the lower edge of the hero, as on the official artwork's background. */
export function HomeHeroSwoosh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 160" preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rhSwoosh" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#db0512" stopOpacity=".95" />
          <stop offset=".45" stopColor="#ff2a36" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff2a36" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rhSwooshFill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#db0512" stopOpacity=".9" />
          <stop offset=".5" stopColor="#db0512" stopOpacity=".25" />
          <stop offset="1" stopColor="#db0512" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 160V96C240 60 470 120 720 132S1180 150 1440 118V160Z" fill="url(#rhSwooshFill)" opacity=".55" />
      <g fill="none" stroke="url(#rhSwoosh)" strokeLinecap="round">
        <path d="M0 104C260 62 520 112 780 124S1200 136 1440 104" strokeWidth="2.4" />
        <path d="M0 126C300 92 560 138 820 142S1220 146 1440 128" strokeWidth="1.4" opacity=".8" />
        <path d="M0 82C220 52 420 86 640 104" strokeWidth="1" opacity=".7" />
      </g>
    </svg>
  );
}

/** Awning: six red/white stripes from the 188px top edge to the 172px bottom edge, with a scalloped hem. */
const AWNING = [0, 2, 4, 6, 8, 10].map((i) => {
  const t = (k: number) => 26 + (188 / 12) * k, b = (k: number) => 34 + (172 / 12) * k;
  return `M${t(i)} 58H${t(i + 1)}L${b(i + 1)} 88H${b(i)}Z`;
});
const SCALLOP = `M34 88${Array.from({ length: 6 }, () => "a14.33 10 0 0 0 28.67 0").join("")}Z`;

/** Banner art: a shop with a large location pin (business registration banner, on red). */
export function StoreArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="120" cy="178" rx="104" ry="9" fill="#000" opacity=".16" />
      <rect x="34" y="78" width="172" height="98" rx="6" fill="#fff" />
      <rect x="34" y="78" width="172" height="12" fill="#f3f4f6" />
      <path d="M26 58h188l-8 30H34Z" fill="#fff" />
      {AWNING.map((d) => <path key={d} d={d} fill="#ffc9cd" />)}
      <path d={SCALLOP} fill="#fff" />
      <rect x="54" y="112" width="58" height="40" rx="4" fill="#ffe4e6" />
      <path d="M54 132h58M83 112v40" stroke="#fff" strokeWidth="3" />
      <rect x="132" y="112" width="48" height="64" rx="4" fill="#ffe4e6" />
      <circle cx="170" cy="146" r="3" fill="#db0512" />
      <rect x="40" y="166" width="18" height="10" rx="3" fill="#2f9e5a" />
      <circle cx="49" cy="160" r="9" fill="#38b26a" />
      <circle cx="198" cy="160" r="9" fill="#38b26a" />
      <rect x="189" y="166" width="18" height="10" rx="3" fill="#2f9e5a" />
      <g transform="translate(120 52)">
        <ellipse cx="0" cy="4" rx="16" ry="5" fill="#000" opacity=".18" />
        <path d="M0 0C-13-15-26-26-26-44a26 26 0 0 1 52 0C26-26 13-15 0 0Z" fill="#fff" />
        <path d="M0-8C-9-19-19-28-19-44a19 19 0 0 1 38 0C19-28 9-19 0-8Z" fill="#db0512" />
        <circle cx="0" cy="-44" r="8" fill="#fff" />
      </g>
    </svg>
  );
}

/** Banner art: a world sphere with red places and connections (global discovery banner, on soft red). */
export function WorldArt({ className }: { className?: string }) {
  const lat = [-50, -20, 10, 40].map((a) => ({ cy: 95 - 78 * Math.sin(a * deg), rx: 78 * Math.cos(a * deg), ry: 12 * Math.cos(a * deg) }));
  return (
    <svg viewBox="0 0 240 190" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="rhWorld" cx=".38" cy=".32" r=".8">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#ffd6d9" />
        </radialGradient>
      </defs>
      <ellipse cx="128" cy="180" rx="84" ry="7" fill="#db0512" opacity=".1" />
      <circle cx="128" cy="95" r="78" fill="url(#rhWorld)" stroke="#f3a9ae" strokeWidth="1.5" />
      <g fill="none" stroke="#f3a9ae" strokeWidth="1">
        {lat.map((l) => <ellipse key={l.cy} cx="128" cy={l.cy} rx={l.rx} ry={l.ry} />)}
        <ellipse cx="128" cy="95" rx="30" ry="78" />
        <ellipse cx="128" cy="95" rx="60" ry="78" />
        <path d="M128 17v156" />
      </g>
      <g fill="none" stroke="#db0512" strokeWidth="1.6" strokeDasharray="3 4" strokeLinecap="round">
        <path d="M92 70Q110 40 140 62" />
        <path d="M140 62Q170 70 168 108" />
        <path d="M92 70Q96 118 132 126" />
      </g>
      {[[92, 70, 1], [140, 62, 1.25], [168, 108, 1], [132, 126, .9]].map(([x, y, s]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M0 0C-5-6-10-10-10-17a10 10 0 0 1 20 0C10-10 5-6 0 0Z" fill="#db0512" />
          <circle cx="0" cy="-17" r="3.6" fill="#fff" />
        </g>
      ))}
    </svg>
  );
}
