# REGA24 competitive matrix — 9 platforms (2026-11-15)

Scope: user-facing capabilities of nine reference platforms compared with the REGA24 code on `main` (after PR #162).
Classification: EXISTS · PARTIAL · MISSING · NOT RELEVANT · UNVERIFIED. Booking, appointments and reservations are
out of scope by owner rule and are not evaluated as gaps. Nothing here is a commitment to build; it ranks evidence.

## Evidence rules
- **V** = verified this session from a public source (listed below). **K** = well-known public product feature, not
  re-checked this session; treat it as a strong hint, not proof. **–** = not checked / no evidence found.
- REGA24 column = verified in the repository code (file references in the last section), not from documentation.

## Matrix

| Capability | Google Maps | Dalilk | ACS (acs-eu.com) | Yelp | Gelbe Seiten | Das Örtliche | Tripadvisor | Justdial | Apple Maps | **REGA24** |
|---|---|---|---|---|---|---|---|---|---|---|
| Categories / professions | K | V | V (15 categories) | K | V | V | K | V | K | **EXISTS** |
| Countries / cities filter | K | V | V (6 countries, ~30 cities) | K | K | V | K | K | K | **EXISTS** (Germany-only city discovery) |
| Search + filters | K | V | V (profession, city, country) | V (service filters) | K | V (radius search) | K | K | K | **PARTIAL** (q, city, category, sort) |
| Map view of results | K | – | MISSING (not on page) | K | K | V (map view) | K | K | K | **PARTIAL** (directions only, no results map) |
| Business profile + owner dashboard | K | V | V (profile pages) | K | V | V | K | V | K | **EXISTS** |
| Reviews / ratings | K | – | V (ratings shown) | K | V | V (>1 M businesses rated) | K | V | K | **EXISTS** |
| Verification / trust badges | K | – | MISSING (not on page) | V (Verified License) | V (Meinungsmeister seal) | – | K | V (verified listings) | K | **EXISTS** (`verified` required for public) |
| Services / products catalogue | K | – | – | V (Portfolio) | – | – | K | V (product quotes) | – | **PARTIAL** (`Service` with `priceFrom`, no product catalogue) |
| Business attributes / facilities | K | – | V (spoken languages) | V (Business Highlights) | – | – | K | – | K | **PARTIAL** (`languages` only) |
| Request a quote / inquiries | – | – | MISSING (not on page) | V (up to 6–10 businesses) | – | – | – | V (5 businesses compete) | – | **EXISTS** (SmartRequest to matched businesses) |
| Offers / announcements | – | – | V ("Ads & offers") | V (special offers) | – | V (current offers) | – | V (offers & coupons) | – | **EXISTS** (`Offer`, no paid promotion) |
| Favourites / saved businesses | K | V | MISSING (not on page) | K | – | V (favourites, export) | K | V (favourites list) | K | **EXISTS** (PR #162, live-verified) |
| Business comparison | – | – | MISSING | – | – | – | – | V (price comparison) | – | **MISSING** |
| Multilingual UI | K | V (Arabic) | V (7 languages) | K | – | – | K | K | K | **EXISTS** (11 locales, RTL + LTR) |
| AI assistant | K | – | – | – | – | – | K | – | – | **EXISTS** (`/ai`, REGA AI agent system) |
| Business service areas (radius) | K | – | – | – | V (10/20/30 km listing radius, paid packages) | V (radius search) | – | – | – | **PARTIAL** (request radius, no per-business area) |
| Accessibility (app level) | K | – | – | K | – | V (VoiceOver, dark mode) | K | – | K | **EXISTS** (WCAG 2.2 AA target, axe in CI) |

## Ranked verified gaps (next safe increments, all €0, no paid feature)

1. **Business attributes / facilities** (PARTIAL → EXISTS). Evidence: Yelp Business Highlights, ACS spoken languages.
   Value: better filtering and trust. Approach: reuse `languages`; an additive attribute list needs a schema change,
   which needs owner approval. Acceptance: owner edits attributes, profile shows them, list filters by them.
2. **Results map** (PARTIAL → EXISTS). Evidence: Das Örtliche map view; Google/Apple Maps. Approach: free OSM tiles
   within their usage policy, or static coordinates list; must not add a paid map API. Risk: tile-usage limits.
3. **Advanced filters** (PARTIAL). Add "open now" (reuse `src/lib/opening-hours.ts`), "languages spoken", "has
   offers". No schema change. Acceptance: filters in URL, server-side, RTL/LTR, e2e.
4. **Business comparison** (MISSING). Evidence: Justdial price comparison. Approach: client-side compare of 2–3 saved
   businesses (reuses PR #162 storage and the `slugs` API). No schema change.
5. **Product catalogue** (PARTIAL). `Service.priceFrom` exists; products need a schema decision (owner approval).

## Sources (verified this session)
- ACS: https://acs-eu.com/en/ (page read 2026-11-15).
- Dalilk: App Store listing (search 2026-11-15) — save favourite businesses, Arabic guide in Europe.
- Das Örtliche: https://www.dasoertliche.de/apps/ (map view, ratings for >1 M businesses, offers, favourites);
  https://apps.apple.com/DE/app/id330158440 (radius search, favourites export, VoiceOver).
- Gelbe Seiten: https://www.pressetext.com/news/gelbe-seiten-bietet-ab-sofort-auch-bewertungen.html (reviews);
  https://www.gelbeseiten.de/gsservice/kooperationspartner (Meinungsmeister reviews);
  https://sellwerk.de/pdfs/terms-conditions/2024-03-20_Produktbeschreibung_Verzeichnispaket_Gelbe%20Seiten_final.pdf
  (listing radius by package).
- Justdial: https://apps.apple.com/us/app/-/id624946027 (favourites, verified listings);
  https://thenextweb.com/news/local-search-engine-justdial-launches-android-app-for-india-and-usa (5 businesses quote).
- Yelp: https://www.buzzfeednews.com/article/carolineodonovan/now-you-can-get-price-quotes-for-home-services-inside-yelp
  (Request a Quote); https://searchengineland.com/yelps-updated-request-a-quote-and-new-nearby-jobs-provide-lead-gen-for-smbs-339368;
  https://searchengineland.com/yelp-announces-new-features-for-services-businesses-including-custom-search-filters-a-new-review-flow-and-themed-ads-375095
  (service filters, Business Highlights, special offers); https://www.marketingdive.com/news/yelp-expands-ad-offerings-national-multi-location-businesses/722374/ (Verified License, Portfolio).
- Google Maps, Apple Maps, Tripadvisor: column marked K (not re-checked this session).

## REGA24 code references
- Saved businesses: `src/lib/saved-businesses.ts`, `src/components/business/SaveButton.tsx`, `src/app/[locale]/saved/page.tsx`.
- Quote requests: `model SmartRequest` (`prisma/schema.prisma`), `src/app/[locale]/smart-request`.
- Offers: `model Offer`; services: `model Service` (`priceFrom`); reviews: `model Review`; languages: `languages String[]`.
- Filters: `src/app/[locale]/businesses/(list)` (q, city, category, sort); opening hours: `src/lib/opening-hours.ts`.
- AI: `src/app/[locale]/ai`, `docs/AI_AGENT_SYSTEM.md`.
