# ADR 0011 — Hierarchical location filter with a saved place

Date: 2026-10-20. Status: accepted. Scope: the existing location (city) filter, its UI, state, query and tests only.

## Context
The city filter was a native `<select>` fed by `listSelectorCities` (bounded to 80 ranked cities), with no search, no country/region step, no
memory between pages and a separate, unconnected city choice on the map. The data model has `Country`, `Region`, `City` (with translations and
coordinates) and `Location.cityId`; there is no district model and the business filter (`businessInCity`) takes exactly one city.

## Decision
- Same filter, better selector: `CityFilter` (same export, same hidden `<select id="f-city" name="city">` GET-form contract) now opens a panel
  (popover from 640 px, bottom sheet below): search box, "use my location", country select (only when more than one country has listings), region
  select (only when the country has regions), and a bounded result list with the number of public businesses per city.
- Data comes from the existing tables through `GET /api/v1/geo` (zod-validated, rate limited, bounded to 40 cities per answer). The whole gazetteer
  is never shipped to the browser. Search matches the typed text, the German transliteration (`koeln`), the accent-free form and the umlaut form,
  across all name columns, the slug and the translations.
- Saved place: `localStorage["rega-location"]` = `{v, cityId, countryCode, regionId, savedAt}` only (no account, never sent to a server by REGA),
  365-day maximum age, in-memory fallback when storage is blocked. One `useSyncExternalStore` store feeds the home page selector, the business
  list selector and the map. A list page without a `city` parameter gets the saved city added with `router.replace`; an explicit empty `city=`
  means "all cities" and clears the saved place (the Reset links point to `?city=`). A stale saved id is verified against the API and dropped.
- Nearby detection is optional and permission-based: the browser position is coarsened, sent once to `/api/v1/geo?lat&lng` (no-store), answered with the nearest
  known city within 60 km, and never stored.
- Homepage keeps a single compact selector; no city lists on the page.

## Not done, on purpose
- Districts: no district data exists; none are invented and no migration was added.
- Multiple cities: the existing filter and `businessInCity` are single-city; changing the query contract is outside the approved scope.
- Countries are limited to Germany plus countries that have public listings.

## Privacy
The storage key is documented in the privacy text of all seven languages (TDDDG: needed to provide the function the visitor asked for).

## Tests
`tests/location-pref.test.ts` (pure helpers), `tests/e2e/location-filter.spec.ts` (API contract, search, keyboard, persistence, home/list/map
sync, reset, nearby detection, bottom sheet, desktop popover, Kurdish RTL), `tests/e2e/catalog.spec.ts` (home search uses the new selector).
