# Bulk avg/min/max and explicit demo query improvements

This change does two independent things:

1. The library now chooses bulk grouping for eligible `.avg()`, `.min()` and `.max()` dependencies, reusing the existing correlation, validation and fallback machinery. `.exists()` keeps its original per-parent short circuit.
2. The full stress application's revenue, cost and stock implementations now use typed `resolveBatch` providers with grouped MongoDB queries. The framework does not rewrite those raw pipelines automatically. Public resources, frontend query bodies, reference endpoints, indexes, budgets, 128-parent batching and per-row concurrency 8 are preserved. Separate loads still execute sequentially.

The six dashboard queries do **not** call avg/min/max. Their improvements therefore measure the application query changes. A dedicated numeric workload measures the library extension separately.

## Method and artifacts

All runs use the deterministic medium seed: **756,804 documents**, four tenants, the same business snapshot, distribution and indexes. MongoDB runs privately with a 0.25 GB WiredTiger cache. Environment: Node 24.14.0, MongoDB 8.2.1, AMD Ryzen 5 PRO 3500U, eight logical CPUs, about 7.7 GB memory.

The primary comparison interleaves before/current implementations in one Node process, connection pool and MongoDB instance. Each case has twelve samples per implementation/concurrency, two warmups, and concurrency 1 and 4. Variant order rotates cyclically between measurement waves. Concurrency-1 variant positions are balanced; the small number of concurrency-4 waves remains a limitation. The numeric control uses a captured copy of the preceding backend; the demo control uses its captured old query declarations with the current backend. Since the dashboard queries do not use avg/min/max, that demo control isolates the query rewrite.

There are **192 timed numeric results** and **432 timed demo/reference results**, for **624 total**. Forty before/current comparisons against independent reference calculations pass across the first and last tenants. Every timed result matches its expected digest, including array order and numeric values. The full AccountResource and ProductResource are retained; this is not the narrower risk-only resource from the earlier ROI experiment.

Artifacts:

- [Paired harness](numeric-and-query-benchmark.cjs) and [raw paired results, plans and module hashes](numeric-and-query-experiment.json).
- [Audited comparison data](numeric-and-query-comparison.json).
- [Before HTTP report](demo-query-rewrite-before/report.md), [before raw data](demo-query-rewrite-before/report.json), [after HTTP report](demo-query-rewrite-after/report.md), [after raw data](demo-query-rewrite-after/report.json).
- [Initial paired trial](numeric-and-query-first-trial.json), [validation-refresh trial](numeric-and-query-validation-trial.json) and [initial HTTP after-run](demo-query-rewrite-first-trial/report.json) are retained. The final run adds finite-result guards and fixes an ordering issue where combining rotation/reversal kept numeric controls first. The tables in this report use the corrected final artifacts.
- [One-sample smoke run](numeric-and-query-smoke.json), used only to validate the harness, not to estimate performance.

The separate HTTP runs each contain 288 timed responses and twelve tenant/view parity checks. All **576 HTTP responses** match their expected digests, and the twelve digests match between runs. Seed parameters, collection counts, indexes, original callback counts and complete-history budget outcomes match. The new custom-provider counters are additional instrumentation.

These are exploratory warm-cache local measurements. Twelve samples do not establish stable tail latency or production capacity. Machine load varied substantially during the separate HTTP runs, so the paired comparison is the stronger evidence for the effect of the code changes.

## Numeric library change

The dedicated workload loads approved paid/shipped order summaries since the fixed financial window for **486 accounts**. It uses the real Accounts/Orders collections, exact managed source policies and native numeric validation. It returns every selected account's result, including nulls for empty relations. An independent direct MongoDB grouping supplies the correctness oracle.

Median direct-executor milliseconds:

| Operation | Before c1 | After c1 | Speedup c1 | Before c4 | After c4 | Speedup c4 |
| --------- | --------: | -------: | ---------: | --------: | -------: | ---------: |
| Average   |     429.7 |     72.1 |      5.96× |     514.9 |     98.0 |      5.25× |
| Minimum   |     429.1 |     74.9 |      5.73× |     497.6 |     93.1 |      5.35× |
| Maximum   |     427.4 |     70.2 |      6.09× |     509.0 |     90.9 |      5.60× |
| All three |    1280.4 |    173.2 |      7.39× |    1445.6 |    224.5 |      6.44× |

Driver command counts remain six for individual operations and fourteen for all three. Each load keeps its own query; this is not multi-aggregate fusion. The all-three timing is a separately measured workload and should not be derived by adding the three single-operation medians. Replacing repeated child lookups/reductions reduces work within those commands.

The compiler change admits the three existing native accumulators to the same bulk path already used by count/sum. Average still uses MongoDB's `$avg`, not a new sum/count calculation. All existing native checks and the result decoder are reused. Empty or all-null nullable numeric inputs preserve null average/minimum/maximum. Numeric-field constraints and inferred `number | null` types remain unchanged. Unsupported native work, application membership, custom parsers and unsupported parent key batches retain their prior fallbacks.

## Demo query changes

The production implementation is in [adira.ts](../server/accounts/details.adira.ts); custom query bodies and output contracts are in [metrics.ts](../server/accounts/revenue.provider.ts).

- Revenue groups gross amount, refunds and order count together for the current account-ID batch, replacing a lookup/group pipeline per account. Net revenue is derived in JavaScript from those typed values with explicit finite-number validation, preserving the former native derivation check even when only filtering/ordering uses that value. Filtering and ordering by net revenue consequently use application evaluation after the shared read.
- Costs use their own batch provider. Revenue-only consumers do not activate Lines reads. Display-only margin loads costs after selecting the financial page.
- Stock groups on-hand amounts, reservations and warehouse count in the same inventory scan, replacing correlated stock lookups and a separate managed warehouse-count read. The managed sales sum remains independently declared and demand-pruned. Available-stock arithmetic also retains explicit finite-number validation.

The stock object is one declared summary: requesting any of its fields activates the query that calculates its three values. SKU-only and sales-only queries prune that summary entirely. This is an explicit application choice to share one scan, not generic library demand fusion or a parallel callback bundle.

The providers receive typed parent inputs and request context, return original opaque parent references, and validate their declared output schemas through the existing relation API. Missing groups produce explicit zero summaries. Foreign arrays are deduplicated against requested keys before grouping, while scalar keys avoid a batch-wide intersection.

The new raw queries enforce scalar tenant equality and exact null/missing soft-delete policy. This also excludes malformed policy arrays that ordinary MongoDB equality/null matches could admit in the old raw producers. Dedicated tests cover those exclusions and cross-tenant rows; the clean-seed parity results do not imply identical behavior for every malformed document previously accepted by raw code.

Paired median direct-executor milliseconds at concurrency 1:

| View             | Before | After | Change | Reference |
| ---------------- | -----: | ----: | -----: | --------: |
| Directory        |    8.1 |   7.9 |  -3.0% |       4.0 |
| Revenue & margin |  185.5 |  96.6 | -47.9% |      59.8 |
| Service Risk     |  324.6 | 208.6 | -35.7% |      69.3 |
| Account 360°     |  171.0 | 174.4 |  +2.0% |      28.5 |
| Order operations |  129.2 | 124.1 |  -4.0% |      23.4 |
| Replenishment    |  210.9 | 126.8 | -39.9% |      41.7 |

Concurrency 4:

| View             | Before | After | Change | Reference |
| ---------------- | -----: | ----: | -----: | --------: |
| Directory        |   15.9 |  17.7 | +11.7% |       6.4 |
| Revenue & margin |  208.1 | 140.5 | -32.5% |      76.1 |
| Service Risk     |  405.9 | 293.8 | -27.6% |     111.4 |
| Account 360°     |  191.4 | 194.6 |  +1.7% |      51.9 |
| Order operations |  183.4 | 183.4 |  +0.0% |      58.8 |
| Replenishment    |  314.2 | 174.9 | -44.3% |      62.0 |

The largest paired gains are finance, risk and replenishment. Directory and order operations have unchanged query plans; their timing movements are not attributed to the rewrite. Account 360° retains its nested include costs and does not improve: its median worsens about 2%, and c1 p95 moves from 214.0 to 225.0 ms. Directory also worsens at c4. These outcomes are retained. The reference remains faster in every paired demo median.

## Actual execution and remaining work

Measured custom-provider counters in the medium after-run:

| View             | Revenue batches / parent inputs | Cost batches / parent inputs | Stock batches / parent inputs |
| ---------------- | ------------------------------: | ---------------------------: | ----------------------------: |
| Revenue & margin |                         4 / 486 |                       1 / 30 |                             0 |
| Service Risk     |                         4 / 486 |                            0 |                             0 |
| Account 360°     |                          1 / 12 |                            0 |                             0 |
| Replenishment    |                               0 |                            0 |                       3 / 356 |

Financial cost work still runs for the thirty selected accounts, and margin is calculated thirty times. Risk still evaluates 486 scores, makes four exposure-provider calls and returns twenty-five rows. Account 360° still evaluates twelve scores, loads twelve manager portfolios, runs twenty-four order-priority callbacks and ninety-four displayed warehouse callbacks. Replenishment still evaluates 356 days-of-cover values and fifty displayed warehouse callbacks. Original callback counts and the complete-history budget failure are unchanged.

Total commands change from 1→10 for finance, 18→25 for risk, 5→6 for Account 360°, and stay 11 for replenishment. Grouping more work efficiently can use more commands while taking less time. The stock rewrite exchanges the old warehouse-count commands for stock-summary commands, avoiding a second inventory scan without lowering the total command count.

Root executionStats cannot account for the new deferred provider commands. The saved plans and runtime provider counters show placement; neither should be described as measured server CPU or request-wide document-examination totals.

The native reference remains faster in the main concurrency-1 comparisons. Independent load scheduling, compatible managed-demand fusion and nested include execution remain separate opportunities. Batch sizes and candidate limits were not increased to obtain these results.

## HTTP cross-check

Median HTTP milliseconds at concurrency 1, from separate private before/after runs:

| View             | Adira before | Adira after | Reference before | Reference after |
| ---------------- | -----------: | ----------: | ---------------: | --------------: |
| Directory        |         19.9 |        10.9 |             14.0 |             5.7 |
| Revenue & margin |        432.1 |       101.0 |             89.2 |            61.4 |
| Service Risk     |        636.6 |       214.8 |            105.5 |            69.4 |
| Account 360°     |        353.5 |       160.0 |             42.6 |            29.7 |
| Order operations |        213.3 |       122.7 |             38.2 |            24.2 |
| Replenishment    |        458.8 |       128.2 |             75.2 |            48.0 |

Both the unchanged reference and unchanged Adira views became materially faster between these runs. Consequently, their large before/after percentages overstate what can be attributed to the code change. Use the interleaved comparison above for attribution, and keep HTTP/direct-executor timings distinct. Raw reports include concurrency-4 and tail results.

## Reproduce and validate

Before rebuilding the changes, capture the preceding compiled implementations from the repository root:

```sh
npm run stress:build
adira_baseline_dir=$(mktemp -d node_modules/.adira-numeric-baseline.XXXXXX)
cp -R packages/backend/dist/read "$adira_baseline_dir/read"
cp examples/stress/dist/server/adira.js examples/stress/dist/server/adira-before-metrics.js
```

After applying/rebuilding the changes, run the paired comparison:

```sh
npm run stress:build
node examples/stress/reports/numeric-and-query-benchmark.cjs \
  --baseline-read "$adira_baseline_dir/read/index.js" \
  --baseline-demo examples/stress/dist/server/adira-before-metrics.js \
  --profile medium --iterations 12 --warmup 2 --concurrency 1,4
```

Baseline capture must happen on the preceding implementation; capturing the current version twice would not measure the change. The raw report records module hashes and input settings. Neither capture changes production source files. The HTTP cross-check uses the existing runner on the corresponding source versions:

```sh
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/demo-query-rewrite-before
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/demo-query-rewrite-after
```

Validation passed: **171 backend MongoDB integration tests**, TypeScript positive/negative and native-diagnostic checks, the generated Express/client bridge test, frontend/backend/Vite builds, and **16 dashboard integration tests**. Added coverage checks bulk avg/min/max after real key overwrites/projections, shared foreign arrays, native fallbacks, malformed numeric values, nullable results, demand pruning, cost-after-page placement, stock scan sharing, exact policy exclusions and overflow rejection even when derived net revenue/available stock are used only in unselected filters. No independent-load scheduler or exists rewrite was added.
