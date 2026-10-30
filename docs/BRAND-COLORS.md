# REGA24 brand colors

Since 2026-10-30 the palette is taken from the official REGA24 logo (owner instruction: "take the colours from the logo"). `--brand: #d42a20` in `src/app/globals.css` is the logo's core red (hue ≈ 3°); white action ink meets AA at 5.06:1. Four logo tones complete the scale: `--brand-glow #e53832` (logo highlight; decoration and large text on deep red only), `--brand-deep #9b1f15`, `--brand-deeper #6b120a` and `--brand-night #2b0805` (logo shadows; header, hero and banners). This supersedes the Figma foundation `#db0512` and the earlier sampled `#fa070d`. Original logo artwork is preserved without recoloring.

The public header uses the deep logo reds with white navigation; its focus ring is white (`.rega-header`). The browser theme colour is `#6b120a`, the manifest `theme_color` and the standalone offline page use `#d42a20`.

## Semantic use

| Token | Use |
| --- | --- |
| `brand` | Primary actions, navigation indicators, map markers and loading accents |
| `brand-hover` | 98% primary + 2% black |
| `brand-ink` | White labels on the Figma red, meeting AA contrast |
| `brand-text` | Accessible red text on content surfaces; darker in light mode, lighter in dark mode |
| `brand-soft` | Derived selected/empty-state backgrounds |
| `brand-control` | Canonical red for native controls and contrasting thumbs |
| `brand-glow`, `brand-deep`, `brand-deeper`, `brand-night` | Logo highlight and shadow tones for the header, home hero, cards fallback and banners |
| `ring` | Canonical red focus indicator |
| `logo-surface` | Asset-matching backing for retained legacy artwork |

The current light background is `#f8fafb`, ink `#171f29` and border `#e8edf2`. Existing dark-mode, success, warning, error, ratings and official third-party icon colors are retained. The home uses the light editorial surface supplied in Figma. This design task also changes typography, composition and branding; it is broader than the earlier color-only migration.

MapLibre paints read the canonical CSS token at runtime; inline SVG pins inherit it. The static manifest and standalone offline page repeat the canonical primary because they work independently of the application stylesheet. Offline actions use the same white foreground and derived hover color. Service-worker cache version changes refresh its precached offline branding.

## Verification and release

`tests/e2e/brand-colors.spec.ts` verifies rendered tokens, shared dashboard danger-menu text, action/hover/link/selected contrast (≥4.5), focus/control/thumb contrast (≥3), axe contrast findings, manifest consistency, overflow and RTL/LTR at 390/1366px in light/dark mode. `offline-brand-colors.spec.ts` verifies the standalone HTML across the same combinations. `figma-responsive.spec.ts` covers eleven locales at eight widths with persisted screenshots and home axe checks. See PROJECT_MEMORY.md and task evidence for actual results; test definitions alone do not establish a pass or a production release.

## Historical reference

The previous color-only task selected `#fa070d` from the owner's `2-Photo-2.jpg`, sample (386,88), RGB (250,7,13). That historical release required black action labels. Its measurements remain in the earlier evidence and do not certify the new Figma implementation.
