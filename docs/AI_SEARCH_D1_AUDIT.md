# AI Search / D1 review — 2026-11-24

Decision: do not provision or enable AI Search. Native D1 sources are officially supported **in beta**. This fails the owner's production eligibility requirement. No new infrastructure, paid service, dependency, binding or production data was created.

## Official documentation checked

- https://developers.cloudflare.com/ai-search/configuration/data-source/d1/ — read-only SQL, required id column, same-account D1 and service token; beta.
- https://developers.cloudflare.com/ai-search/platform/limits-pricing/ — billing starts December 1, 2026. Monthly included usage per account: 5 million ingestion tokens, 10 GB-month storage, 1,000 semantic and 1,000 full-text queries. Overage: $0.75/million ingestion tokens, $2/GB-month, $0.75/1,000 semantic/vector/hybrid queries, $0.10/1,000 full-text queries. Generation and query rewriting remain separately billed. Included usage alone does not establish a zero-cost hard stop.
- https://developers.cloudflare.com/changelog/post/2026-11-02-billing-postponed-default-sync-interval/ — default sync is 24 hours; an index cannot itself guarantee immediate removal of unpublished/deleted records.
- https://developers.cloudflare.com/d1/platform/pricing/ — free-tier exhaustion rejects database queries. A fallback using the same exhausted D1 database cannot promise normal availability.

## Existing architecture and live evidence

GitHub repository and identity guard verified. Live Worker `rega24` has the expected DB binding to `rega24-migration` (database id matches wrangler.jsonc), SEARCH_LIMITER and AI_LIMITER. No AI Search binding. Default AI Search namespace returned an empty instance list; other namespaces were not inventoried. Secret values were not retrieved. Account billing plan and account-wide remaining quotas are not verified.

Reuse `search-where.ts`, `search-index.ts`, `search-correction.ts`, `search-intent.ts`, `data/index.ts` and `data/geo.ts`. PUBLIC_BUSINESS requires published, verified, nondeleted, nonarchived businesses in active public business categories. Geography queries additionally require active nondeleted locations. Existing application AI gateway is in `src/lib/ai`; it is distinct from Cloudflare's managed AI Gateway. This review did not alter either provider configuration or RBAC.

## Implemented accuracy improvement

Shared query correction now preserves every token containing a Unicode number, including alphanumeric postal codes and house numbers. Previously only entirely numeric tokens were protected. Unknown `sw1b`, `1ab`, `12c` could be changed to different stored identifiers. Text-only business/service typo correction remains active. Tests use an in-memory vocabulary only.

## Future integration gates (not implemented or enabled)

Once beta and zero-cost blockers are resolved, use the existing database and search entry point. A fixed, reviewed SELECT must explicitly project public business fields, join active public categories and active locations, and exclude accounts, credentials and administrative fields. Do not use SELECT *, client SQL, or LLM-generated SQL. Revalidate returned IDs against live PUBLIC_BUSINESS and location predicates before returning any record; discard stale hits. Numeric/address constraints remain deterministic. Return authoritative database fields, never generated business/location claims. Reuse existing input limits, rate limiting, authorization and provider budget controls. Enforce account-wide ingestion/storage/query limits before enabling background sync; request-only counters cannot cap indexing costs. No index/public endpoint should be provisioned until these gates are proven.

## Local microbenchmark

Synthetic vocabulary; five queries (German, Kurmanji, Sorani, alphanumeric identifiers), 1,000 warmups then 5,000 iterations, one run per version. Baseline p50 0.006219 ms / p95 0.009694 ms; candidate p50 0.005689 ms / p95 0.009875 ms. Difference is noise, not evidence of a speedup. This measures pure correction only, not network/D1 latency, semantic relevance, mobile rendering or production performance. No production businesses were inserted.
