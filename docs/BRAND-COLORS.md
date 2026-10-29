# REGA24 brand colors

The primary solid is `--brand: #fa070d` in `src/app/globals.css`. Tailwind v4 uses the existing inline `@theme` configuration in that file; no separate Tailwind configuration is needed.

## Reference and selection

Owner-supplied `2-Photo-2.jpg` (719 × 1280), SHA-256 `3911dd5a1fc48247c71bc605ca7e690234531af3cb73d7683e3d608ae7d8f087`. The pixel at zero-based (386, 88) is RGB (250, 7, 13). This is in the upper background, above the logo and metallic reflections. Filtering the upper 20% to R ≥ 240, G/B ≤ 24 yields 11,426 saturated pixels; the selected RGB occurs 157 times. It is a representative vivid red close to the requested #FF0000 reference, not the darker shadow mode. Neither supplied image is added to the website.

Previously the global/Figma primary was #DC0201, dark mode had an independent OKLCH red, maps repeated literal reds, and panels/shadows used other hardcoded reds.

## Semantic use

| Token | Use |
| --- | --- |
| `brand` | Canonical solid accent, primary actions, navigation indicators, markers, loading accents |
| `brand-hover` | 98% primary + 2% black; keeps dark action labels readable |
| `brand-ink` | Black labels on vivid red; white normal-sized text fails AA on this red |
| `brand-text` | Accessible red text on content surfaces; darker in light surfaces, lighter in dark surfaces |
| `brand-soft` | Derived tinted selected/empty-state backgrounds |
| `brand-control` | Canonical red for native controls and switches, with contrasting checkmarks/thumbs |
| `ring` | Canonical red focus indicator |
| `logo-surface` | Existing #DC0201 backing next to immutable official artwork only |

Primary white content surfaces remain; requested supporting ink is #171717 and neutral background #FAFAFA. Existing success, warning, error, ratings and third-party official icon colors are preserved. Existing home light surfaces retain light text tokens even in dark mode. Logo backing is deliberately asset-matched: recoloring its red pixels or changing its artwork is outside scope.

MapLibre paints read the canonical CSS token at runtime; inline SVG pins inherit it. `public/manifest.webmanifest` is a static browser document and necessarily repeats the primary hex; the browser regression checks it against the selected primary. Do not introduce another JS primary constant.

## Verification and release

`tests/e2e/brand-colors.spec.ts` verifies rendered tokens, action/hover/link/selected contrast (≥4.5), focus/control/thumb contrast (≥3), brand-related axe contrast findings, manifest consistency, overflow and RTL/LTR at 390/1366 px in light/dark mode; captures screenshots and measured ratios. See the task evidence and PROJECT_MEMORY.md for actual results and release blockers. Existing a11y tests report contrast findings without failing them; the new brand regression explicitly fails brand contrast findings.

No layout, typography, translations, logo files, database schema, production records, dependencies, routes, authentication, infrastructure or release workflow changes are part of this migration.
