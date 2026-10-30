/**
 * Original inline artwork for the home page of the approved REGA24 reference (no photograph, no network request):
 * a sunset over the Earth's curve with a world skyline (New York, London, Rome, Paris, Dubai, a mosque, a palm) in
 * the official logo's reds. Decorative only: every SVG here is aria-hidden.
 */

/** Deterministic window lights (no Math.random: server and client must render the same markup). */
const WINDOWS: Array<[number, number]> = [
  [606, 420], [618, 452], [606, 488], [640, 360], [646, 400], [640, 446], [668, 430], [684, 462], [672, 500], [708, 392],
  [716, 430], [708, 470], [734, 452], [740, 488], [1160, 470], [1172, 500], [1190, 440], [1202, 480], [1318, 410],
  [1328, 450], [1318, 492], [1346, 470], [1270, 300], [1262, 400], [1274, 520], [1250, 600], [822, 500], [834, 530],
];
const CITY_LIGHTS: Array<[number, number, number]> = [
  [640, 637, 2.2], [700, 592, 1.6], [760, 574, 2], [830, 532, 1.4], [905, 518, 2.4], [980, 493, 1.6], [1060, 491, 2.2], [1130, 511, 1.4], [1210, 499, 2], [1290, 522, 1.6], [1370, 534, 2.2], [1440, 570, 1.4], [880, 570, 1.6], [1010, 535, 2], [1160, 552, 1.6], [1320, 574, 2], [760, 634, 1.4], [1090, 580, 1.2], [1500, 614, 1.6], [1560, 641, 1.2],
];
const STARS: Array<[number, number, number]> = [
  [720, 60, 1.2], [820, 110, .9], [930, 46, 1.4], [1040, 96, 1], [1150, 40, 1.1], [1330, 70, 1.3], [1450, 130, .9],
  [1540, 52, 1.2], [870, 180, .8], [1390, 200, .9], [1210, 150, .8], [990, 210, .7], [1500, 260, .8],
];
const COLOSSEUM_ARCHES = Array.from({ length: 3 }, (_, row) => Array.from({ length: 8 }, (_, col) => [868 + col * 16.5, 500 + row * 30] as const)).flat();

export function HeroWorldArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1600 720" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c0503" />
          <stop offset=".45" stopColor="#4a0d07" />
          <stop offset=".75" stopColor="#9b1f15" />
          <stop offset="1" stopColor="#d4452a" />
        </linearGradient>
        <radialGradient id="rh-sun" cx=".5" cy=".62" r=".5">
          <stop offset="0" stopColor="#ffe0bd" />
          <stop offset=".14" stopColor="#ff9a66" />
          <stop offset=".38" stopColor="#e53832" stopOpacity=".85" />
          <stop offset=".7" stopColor="#9b1f15" stopOpacity=".35" />
          <stop offset="1" stopColor="#6b120a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rh-city" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d0c07" />
          <stop offset="1" stopColor="#140302" />
        </linearGradient>
        <radialGradient id="rh-globe" cx=".5" cy="0" r="1">
          <stop offset="0" stopColor="#6b1a0f" />
          <stop offset=".18" stopColor="#3a0b06" />
          <stop offset=".5" stopColor="#1c0503" />
          <stop offset="1" stopColor="#0e0201" />
        </radialGradient>
        <linearGradient id="rh-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd2a8" stopOpacity="0" />
          <stop offset=".5" stopColor="#ffd2a8" />
          <stop offset="1" stopColor="#e53832" stopOpacity=".2" />
        </linearGradient>
        <filter id="rh-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="rh-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
        <clipPath id="rh-globe-clip"><circle cx="1100" cy="1290" r="820" /></clipPath>
      </defs>

      <rect width="1600" height="720" fill="url(#rh-sky)" />
      <ellipse cx="1110" cy="470" rx="780" ry="430" fill="url(#rh-sun)" />
      <g fill="#fff">
        {STARS.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} opacity=".55" />)}
      </g>
      {/* Thin sunset clouds */}
      <g fill="#ffb98f" opacity=".14" filter="url(#rh-glow)">
        <ellipse cx="900" cy="300" rx="190" ry="10" />
        <ellipse cx="1280" cy="250" rx="240" ry="12" />
        <ellipse cx="1120" cy="350" rx="160" ry="7" />
      </g>

      {/* Skyline on the Earth's curve: bases run behind the globe. */}
      <g transform="translate(289 -72) scale(.78)">
      <g fill="url(#rh-city)">
        {/* New York: Statue of Liberty and towers */}
        <rect x="535" y="560" width="50" height="340" />
        <rect x="528" y="545" width="64" height="20" />
        <path d="M545 545 548 470 546 430 552 420h16l6 10-2 40 3 75Z" />
        <circle cx="560" cy="408" r="9" />
        <path d="m548 404-6-10 9 6 1-12 5 10 3-11 3 11 5-10 1 12 9-6-6 10Z" />
        <path d="M566 424 578 352l8 1-10 75Z" />
        <path d="M577 352h12l-2-8h-8Z" />
        <rect x="598" y="380" width="30" height="520" />
        <rect x="628" y="340" width="30" height="560" />
        <rect x="634" y="310" width="18" height="40" />
        <rect x="640" y="270" width="6" height="45" />
        <rect x="642" y="236" width="2" height="40" />
        <rect x="660" y="400" width="36" height="500" />
        <rect x="698" y="360" width="26" height="540" />
        <rect x="726" y="430" width="24" height="470" />
        {/* London: Elizabeth Tower and parliament */}
        <rect x="752" y="470" width="20" height="430" />
        <rect x="774" y="330" width="32" height="570" />
        <rect x="770" y="298" width="40" height="46" />
        <rect x="776" y="280" width="28" height="20" />
        <path d="M772 282 790 228l18 54Z" />
        <rect x="789" y="210" width="2" height="22" />
        <rect x="808" y="460" width="44" height="440" />
        <path d="m808 462 6-16 6 16Zm16 0 6-16 6 16Zm16 0 6-16 6 16Z" />
        {/* Rome: Colosseum */}
        <path d="M858 900V495q0-25 72-29 72 4 72 29v405Z" />
        {/* Paris: Eiffel Tower */}
        <path d="m1090 196 4 44 4 90 10 90 16 100 26 200h-32q-28-80-56 0h-32l26-200 16-100 10-90 4-90Z" />
        <rect x="1089" y="176" width="2" height="22" />
        <rect x="1140" y="440" width="34" height="460" />
        <rect x="1176" y="400" width="30" height="500" />
        <rect x="1208" y="470" width="20" height="430" />
        {/* Dubai: Burj Khalifa */}
        <path d="M1263 110h4l1 70 6 2 2 78 7 2 3 98 8 2 3 108 9 2 2 248h-86l2-248 9-2 3-108 8-2 3-98 7-2 2-78 6-2Z" />
        <rect x="1310" y="380" width="30" height="520" />
        <rect x="1342" y="440" width="22" height="460" />
        {/* Mosque: dome and two minarets */}
        <rect x="1370" y="470" width="80" height="430" />
        <path d="M1374 470q0-68 36-78 36 10 36 78Z" />
        <rect x="1409" y="376" width="2" height="18" />
        <rect x="1356" y="360" width="8" height="540" />
        <path d="m1355 362 5-22 5 22Z" />
        <rect x="1456" y="360" width="8" height="540" />
        <path d="m1455 362 5-22 5 22Z" />
      </g>
      {/* Palm */}
      <g fill="none" stroke="#1a0402" strokeLinecap="round">
        <path d="M1520 900q10-220-8-396" strokeWidth="7" />
        <path d="M1512 504q-40-20-74 6M1512 504q-30-34-66-30M1512 504q4-40 40-52M1512 504q40-14 70 12M1512 504q30 8 44 46M1512 504q-26 10-40 46" strokeWidth="5" />
      </g>
      {/* Lights: windows, clock face, torch, arches */}
      <g fill="#ffb37a">
        {WINDOWS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="3" height="5" opacity=".55" />)}
        {COLOSSEUM_ARCHES.map(([x, y]) => <path key={`${x}-${y}`} d={`M${x} ${y + 18}v-11a5 5 0 0 1 10 0v11Z`} opacity=".22" />)}
      </g>
      <circle cx="790" cy="321" r="11" fill="#ffe0bd" opacity=".9" />
      <path d="M583 344c-4-6-2-12 0-16 2 4 4 10 0 16Z" fill="#ffd2a8" />
      <circle cx="583" cy="338" r="9" fill="#ff9a66" opacity=".45" filter="url(#rh-soft)" />
      </g>

      {/* Earth */}
      <circle cx="1100" cy="1290" r="832" fill="none" stroke="#ff7a52" strokeWidth="14" opacity=".45" filter="url(#rh-glow)" />
      <circle cx="1100" cy="1290" r="820" fill="url(#rh-globe)" />
      <g clipPath="url(#rh-globe-clip)" fill="none" stroke="#ff8f66" strokeWidth="1" opacity=".16">
        <circle cx="1100" cy="1290" r="780" />
        <circle cx="1100" cy="1290" r="730" />
        <circle cx="1100" cy="1290" r="670" />
        <ellipse cx="1100" cy="1290" rx="200" ry="820" />
        <ellipse cx="1100" cy="1290" rx="430" ry="820" />
        <ellipse cx="1100" cy="1290" rx="640" ry="820" />
      </g>
      <circle cx="1100" cy="1290" r="820" fill="none" stroke="#ffc49a" strokeWidth="1.6" opacity=".8" />
      {/* Connected places: arcs between city lights */}
      <g fill="none" stroke="url(#rh-arc)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M700 592Q840 329 980 493" />
        <path d="M980 493Q1135 309 1290 522" />
        <path d="M905 518Q1032 362 1160 552" />
        <path d="M1210 499Q1325 357 1440 570" />
      </g>
      <g fill="#ffd2a8">
        {CITY_LIGHTS.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} opacity=".85" />)}
      </g>
      <g fill="#ff9a66" opacity=".55" filter="url(#rh-soft)">
        <circle cx="980" cy="493" r="6" /><circle cx="1290" cy="522" r="5" /><circle cx="700" cy="592" r="5" />
      </g>
    </svg>
  );
}

/** Dotted world pattern for the compact map banner (abstract, decorative). */
export function MapBannerArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="rh-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" /></pattern>
        <radialGradient id="rh-dots-fade" cx=".5" cy=".5" r=".55">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="rh-dots-mask">
          <rect width="600" height="200" fill="url(#rh-dots-fade)" />
        </mask>
        {/* Simplified continents (abstract silhouettes) */}
        <clipPath id="rh-land">
          <path d="M40 60q30-30 80-24t70 20q10 30-20 44t-40 40q-20 10-30-10t-30-30q-40-10-30-40ZM150 120q30 0 36 30t-14 46q-16-10-20-36t-2-40ZM250 40q40-20 80-6 20 10 10 24-30 6-40 20t-34 0q-30-16-16-38ZM270 92q30-6 44 14t4 50q-14 30-30 20t-20-44q-6-30 2-40ZM330 40q60-26 140-12 60 10 80 36-10 24-50 22t-40 30q-30 10-50-10t-50-20q-40-6-30-46ZM470 130q30-6 46 10t-6 30q-26 6-40-10t0-30Z" />
        </clipPath>
      </defs>
      <g mask="url(#rh-dots-mask)">
        <rect width="600" height="200" fill="url(#rh-dots)" clipPath="url(#rh-land)" opacity=".5" />
      </g>
    </svg>
  );
}
