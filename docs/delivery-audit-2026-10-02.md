# REGA 2.0 — پشکنین و پلانی گەیاندن

## بنەڕەت

- Snapshot ـی سەرەتایی `.git` نییە و دەستکاری نەکراوە.
- Repository ـی دیاریکراوی بەکارهێنەر: `https://github.com/rebar9988-max/Rega.git`؛ جیاوازە لە لینکەکەی master prompt.
- بنەڕەتی checkout: `main`, `0cf7e6597a20360160a7481acc264e5266256c9c`؛ working tree پاک بوو.
- `AGENTS.md` نەدۆزرایەوە؛ `CLAUDE.md` خوێندراوەتەوە. architecture و ناسنامەی REGA دەپارێزرێن.
- Stack لە manifest: Next.js 15، React 19، Auth.js 5 beta، Prisma 6.19، PostgreSQL، OpenNext/Cloudflare و MapLibre. وەشانی دامەزراو پاش installation دیاری دەکرێت.
- CI تاقیکردنەوە و build دەکات؛ workflow ـی deployment لە checkout نییە. دەستگەیشتنی نووسین لە GitHub و Cloudflare هێشتا پشتڕاست نەکراوەتەوە.

## دۆزراوەکان

| پلە | بەڵگە | کاریگەری | چارەسەر و پێوەری قبوڵکردن |
| --- | --- | --- | --- |
| بەرز | `tests/e2e/global-setup.ts#assertSafeDatabase` هەموو هەڵەکانی probe دەشارێتەوە | پشکنینی پاراستنی database لە کاتی شکستی connection/schema بەردەوام دەبێت بۆ seed | تەنها هەڵەی دیاریکراوی نەبوونی خشتە ڕێگەپێدراو بێت؛ timeout/auth/network ڕابگیرێن |
| بەرز | `src/auth.config.ts#jwt` role/status تا 5 خولەک cache دەکات و لە database outage مۆڵەتی کۆن دەپارێزێت | suspended/demoted actor دەتوانێت privileged guard تێپەڕێنێت | `requirePermission` و `requireStaff` account ـی active لە database پشتڕاست بکەنەوە و لە outage fail closed بن |
| بەرز | `src/lib/business-admin.ts#save` و API PATCH گۆڕانکاریی listing ـی published ڕاستەوخۆ دەنووسن | گۆڕینی identity/activity دەتوانێت review تێپەڕێنێت | نووسینی خاوەن بەبێ مۆڵەتی publish لە public version ڕابگیرێت تا versioning ـی review ئامادە بێت |
| مامناوەند | `src/features/auth/actions.ts#sendVerification` ئەنجامی boolean ـی `sendEmail` پشتگوێ دەخات | شکستی provider وەک ناردنی سەرکەوتوو پیشان دەدرێت | register/resend/forgot بەڵێنی ناردن نەدەن کاتێک delivery شکست دەهێنێت؛ password hashing و verification نەپەسێندرێن |
| بەرز، داواکاریی جێبەجێنەکراو | policy ـی eligibility لە write paths نەدۆزرایەوە؛ moderation لە draft/pending/published/archived پێکهاتووە | کاروباری قەدەغەکراو و status ـە داواکراوەکان بە تەواوی کۆنترۆڵ نەکراون | policy ـی server، reason، transition و تاقیکردنەوەی database پێویستن پێش enable/release |
| بەرز، داواکاریی جێبەجێنەکراو | upload URL بەبێ business/service ڕێگەپێدراوە و quota ـی cover + 3 gallery نییە | خاوەن دەتوانێت storage ـی بێسنوور بەکاربهێنێت | attachment/ownership، quota ـی transaction و پشکنینی ناوەڕۆکی upload پێویستن |
| بەرز، داواکاریی جێبەجێنەکراو | MFA/reauthentication لە auth ـی پشکنراو نەدۆزرایەوە | privileged access پێوەری prompt پڕ ناکاتەوە | MFA + recovery ـی پشکنراو پێویستە؛ credential/provider نابێت دابهێنرێت |
| بەرز | `src/lib/edge-cache.ts#TTL_SECONDS` cache ـی 300 چرکە هەیە؛ revalidatePath cache ـی Worker ناسڕێتەوە | listing ـی suspended/archive تا TTL لە HTML دەمێنێتەوە | invalidation ـی پشکنراو پێویستە؛ کەمکردنەوەی CPU protection بەبێ پێوانەکردن نابێت |

تۆمارکردن لە manifest، schema و write paths ـی پشکنراودا payment gate نییە؛ نرخەکانی service نرخەکانی خودی خزمەتگوزاریی کاروبارن. billing dependency ـی پێویست بە سڕینەوە نەدۆزرایەوە. ئەمە بەڵگەی هەموو ڕەفتاری production نییە.

## پلانی ڕیزبەندی

1. **Phase 1:** baseline، audit و ئەم plan ـە؛ هیچ production write نییە.
2. **Phase 2:** fail-closed test-database guard و ڕاستگۆیی delivery؛ unit tests، lint و typecheck. هیچ migration یان خەرجی نوێ نییە.
3. **Phase 3:** moderation/ownership، retry safety، upload و eligibility؛ وابەستە بە database ـی تاقیکردنەوە و versioning design. قبوڵکردن: cross-owner/direct-request bypass نەبێت، public تەنها approved version بێت.
4. **Phase 4–5:** admin MFA/recovery، granular permissions، free owner experience؛ پێویستی بە configuration ـی پشتڕاستکراو و E2E هەیە. paid provider زیاد ناکرێت.
5. **Phase 6:** RTL/LTR، keyboard و mobile لە UI ـی هەنووکە؛ screenshot و browser evidence پێویستن، redesign ناکرێت.
6. **Phase 7–8:** cache invalidation، search/map و AI allowlists/cost limits؛ پێویستی بە runtime bindings، provider terms و multilingual evaluation هەیە. هیچ provider ـی paid چالاک ناکرێت.
7. **Phase 9:** job expiry/source/review dates و community moderation؛ public query و E2E پێویستن.
8. **Phase 10:** final diff، هەموو checks، target/environment، recovery، push/PR و release تەنها دوای پشتڕاستکردنەوەی پێوەرەکان. production migration تەنها بە approval ـی تایبەت.

## مەترسی و recovery

Public-version storage لە schema ـی هەنووکەدا نییە؛ پاراستنی approved version لە کاتی review پێویستی بە design و migration plan هەیە. هیچ schema change یان production migration لەم قۆناغەدا ناکرێت. temporary safety guard دەتوانێت editing ـی published listing بۆ خاوەن ڕابگرێت؛ dashboard دەبێت بە ڕوونی ئەوە بڵێت.

Recovery: هەر گۆڕانکارییەک لە branch ـی تایبەت review بکرێت؛ پاش release rollback بە deployment ـی پێشووی پشتڕاستکراو بکرێت. database reset، force push و سڕینەوەی record ممنوعن. تا deployment ID و deployed commit نەبینرێن، release/production verified ڕاناگەیەنرێت.

## ئەنجامی پشکنینی ژینگە و production

- GitHub credential ـی هەنووکە push/admin access هەیە؛ هیچ credential value چاپ نەکراوە.
- CI ـی baseline لە `37055429869` سەرکەوتووە. `Production health` لە `37060747739` شکست هێناوە: directory routes (`/de/businesses`, `/de/services`, `/de/locations`) و `/ckb/about` وەڵامی 500، و پشکنینی sitemap شکستی هێناوە.
- GET ـی ڕاستەوخۆی audit: `/api/v1/health` = 200/database ok، `/de/register` = 200، `/de/businesses` = 500، `/ckb` = 200. health دەڵێت `email=false` و `storage=false`. ئەمە registration/listing journey ـی operational پشتڕاست ناکاتەوە.
- deployed commit و Worker runtime error نەبینراون؛ 500 نابێت بەبێ log وەک Error 1102 ناوزەد بکرێت.
- GitHub repository secrets ـی `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` و database لە metadata نەدۆزرانەوە؛ environment secrets هێشتا پشتڕاست نەکراون. workflow ـی read-only diagnostics لە `main` dispatch کرا. هیچ runtime secret زیاد/گۆڕ نەکراوە.
- لەم ئامێرە Docker، psql و pg_ctl نییە و database/Cloudflare credential environment variables نەدۆزرانەوە. PostgreSQL ـی کاتی CI بە خواستی بەکارهێنەر بۆ تاقیکردنەوە هەڵبژێردرا.

## گۆڕانکاری و checks

- locally changed: verification delivery، fresh authorization guards، fail-closed E2E probe، Windows path test و Worker lint warning.
- هیچ file ـێک نەسڕاوەتەوە، هیچ record یان schema نەگۆڕدراوە، هیچ payment gate زیاد نەکراوە.
- installed versions: Next.js `15.5.26`، React `19.3.0`، Auth.js `5.0.0-beta.32`، Prisma `6.19.3`؛ Node `24.21.0`. `npm ci --ignore-scripts` و `prisma generate` سەرکەوتوون؛ npm audit لە installation ـدا 0 vulnerability ڕاپۆرت کرد.
- unit run پێش fresh authorization fix: 167 pass، 0 fail، 1 database-dependent skip. Node build سەرکەوتوو بوو؛ permission change پاش ئەو build ـە کراوە و final checks/CI پێویستن.
- Windows sandbox subprocess بە EPERM و Google Fonts fetch بە ECONNREFUSED ڕاگیران؛ rerun ـی ڕێگەپێدراو سەرکەوتوو بوو. هیچ test یان CI gate لاواز نەکراوە.

کارەکە تەواو نییە: Phase 2 runtime diagnosis و Phase 3–10 acceptance هێشتا ماون. merge/deploy ڕاگیراوە تا checks و پێوەرەکان پشتڕاست بکرێنەوە. recovery ـی ئەم patch ـە code-only revert ـە؛ database rollback پێویست نییە.
