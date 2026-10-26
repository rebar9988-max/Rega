# Route and API index

Source: `8edc1ed873ed9c382400a935d77f44966ee64992`. Presence is not proof of runtime enablement or anonymous access. Route groups in parentheses do not appear in URLs.

| Route | Type/method | Source |
|---|---|---|
| `/[locale]/[...rest]` | Page | `src/app/[locale]/[...rest]/page.tsx` |
| `/[locale]/about` | Page | `src/app/[locale]/about/page.tsx` |
| `/[locale]/account` | Page | `src/app/[locale]/account/page.tsx` |
| `/[locale]/ai` | Page | `src/app/[locale]/ai/page.tsx` |
| `/[locale]/auth` | Page | `src/app/[locale]/auth/page.tsx` |
| `/[locale]/business/[slug]` | Page | `src/app/[locale]/business/[slug]/page.tsx` |
| `/[locale]/businesses` | Page | `src/app/[locale]/businesses/(list)/page.tsx` |
| `/[locale]/businesses/[slug]` | Page | `src/app/[locale]/businesses/[slug]/page.tsx` |
| `/[locale]/city/[citySlug]/[categorySlug]` | Page | `src/app/[locale]/city/[citySlug]/[categorySlug]/page.tsx` |
| `/[locale]/city/[citySlug]` | Page | `src/app/[locale]/city/[citySlug]/page.tsx` |
| `/[locale]/contact` | Page | `src/app/[locale]/contact/page.tsx` |
| `/[locale]/events/[slug]` | Page | `src/app/[locale]/events/[slug]/page.tsx` |
| `/[locale]/events` | Page | `src/app/[locale]/events/page.tsx` |
| `/[locale]/for-business` | Page | `src/app/[locale]/for-business/page.tsx` |
| `/[locale]/forgot-password` | Page | `src/app/[locale]/forgot-password/page.tsx` |
| `/[locale]/guides/[slug]` | Page | `src/app/[locale]/guides/[slug]/page.tsx` |
| `/[locale]/guides` | Page | `src/app/[locale]/guides/page.tsx` |
| `/[locale]/impressum` | Page | `src/app/[locale]/impressum/page.tsx` |
| `/[locale]/jobs/[slug]` | Page | `src/app/[locale]/jobs/[slug]/page.tsx` |
| `/[locale]/jobs` | Page | `src/app/[locale]/jobs/page.tsx` |
| `/[locale]/locations` | Page | `src/app/[locale]/locations/page.tsx` |
| `/[locale]/login` | Page | `src/app/[locale]/login/page.tsx` |
| `/[locale]/nearby` | Page | `src/app/[locale]/nearby/page.tsx` |
| `/[locale]/p/[slug]` | Page | `src/app/[locale]/p/[slug]/page.tsx` |
| `/[locale]` | Page | `src/app/[locale]/page.tsx` |
| `/[locale]/privacy` | Page | `src/app/[locale]/privacy/page.tsx` |
| `/[locale]/register` | Page | `src/app/[locale]/register/page.tsx` |
| `/[locale]/report` | Page | `src/app/[locale]/report/page.tsx` |
| `/[locale]/reset-password` | Page | `src/app/[locale]/reset-password/page.tsx` |
| `/[locale]/search` | Page | `src/app/[locale]/search/page.tsx` |
| `/[locale]/services` | Page | `src/app/[locale]/services/(list)/page.tsx` |
| `/[locale]/services/[businessSlug]/[slug]` | Page | `src/app/[locale]/services/[businessSlug]/[slug]/page.tsx` |
| `/[locale]/terms` | Page | `src/app/[locale]/terms/page.tsx` |
| `/[locale]/verify-email` | Page | `src/app/[locale]/verify-email/page.tsx` |
| `/api/auth/[...nextauth]` | Re-exported handler | `src/app/api/auth/[...nextauth]/route.ts` |
| `/api/health` | Re-exported handler | `src/app/api/health/route.ts` |
| `/api/v1/ai/chat` | GET, POST | `src/app/api/v1/ai/chat/route.ts` |
| `/api/v1/businesses/[id]` | GET, PATCH, DELETE | `src/app/api/v1/businesses/[id]/route.ts` |
| `/api/v1/businesses/bulk` | POST | `src/app/api/v1/businesses/bulk/route.ts` |
| `/api/v1/businesses` | GET, POST | `src/app/api/v1/businesses/route.ts` |
| `/api/v1/categories` | GET, POST | `src/app/api/v1/categories/route.ts` |
| `/api/v1/geo` | GET | `src/app/api/v1/geo/route.ts` |
| `/api/v1/health` | GET | `src/app/api/v1/health/route.ts` |
| `/api/v1/locations` | GET, POST | `src/app/api/v1/locations/route.ts` |
| `/api/v1/media/business-image` | POST | `src/app/api/v1/media/business-image/route.ts` |
| `/api/v1/media/upload-url` | POST | `src/app/api/v1/media/upload-url/route.ts` |
| `/api/v1/nearby` | GET | `src/app/api/v1/nearby/route.ts` |
| `/api/v1/search` | GET | `src/app/api/v1/search/route.ts` |
| `/api/v1/views` | POST | `src/app/api/v1/views/route.ts` |
| `/dr/ai` | Page | `src/app/dr/ai/page.tsx` |
| `/dr/audit` | Page | `src/app/dr/audit/page.tsx` |
| `/dr/businesses/[id]` | Page | `src/app/dr/businesses/[id]/page.tsx` |
| `/dr/businesses/new` | Page | `src/app/dr/businesses/new/page.tsx` |
| `/dr/businesses` | Page | `src/app/dr/businesses/page.tsx` |
| `/dr/categories/[id]` | Page | `src/app/dr/categories/[id]/page.tsx` |
| `/dr/categories/new` | Page | `src/app/dr/categories/new/page.tsx` |
| `/dr/categories` | Page | `src/app/dr/categories/page.tsx` |
| `/dr/content/[section]/[id]` | Page | `src/app/dr/content/[section]/[id]/page.tsx` |
| `/dr/content/[section]/new` | Page | `src/app/dr/content/[section]/new/page.tsx` |
| `/dr/content/[section]` | Page | `src/app/dr/content/[section]/page.tsx` |
| `/dr/geography/city/[id]` | Page | `src/app/dr/geography/city/[id]/page.tsx` |
| `/dr/geography` | Page | `src/app/dr/geography/page.tsx` |
| `/dr/messages` | Page | `src/app/dr/messages/page.tsx` |
| `/dr/offers/[id]` | Page | `src/app/dr/offers/[id]/page.tsx` |
| `/dr/offers/new` | Page | `src/app/dr/offers/new/page.tsx` |
| `/dr` | Page | `src/app/dr/page.tsx` |
| `/dr/pages/[id]` | Page | `src/app/dr/pages/[id]/page.tsx` |
| `/dr/pages/new` | Page | `src/app/dr/pages/new/page.tsx` |
| `/dr/pages` | Page | `src/app/dr/pages/page.tsx` |
| `/dr/reports` | Page | `src/app/dr/reports/page.tsx` |
| `/dr/reviews` | Page | `src/app/dr/reviews/page.tsx` |
| `/dr/services/[id]` | Page | `src/app/dr/services/[id]/page.tsx` |
| `/dr/services/new` | Page | `src/app/dr/services/new/page.tsx` |
| `/dr/services` | Page | `src/app/dr/services/page.tsx` |
| `/dr/users` | Page | `src/app/dr/users/page.tsx` |
| `/owner-login` | Page | `src/app/owner-login/page.tsx` |
| `/sitemap.xml` | GET | `src/app/sitemap.xml/route.ts` |
| `/sitemaps/[file]` | GET | `src/app/sitemaps/[file]/route.ts` |
