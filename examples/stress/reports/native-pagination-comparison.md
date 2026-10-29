# Native display enrichment after pagination

Account 360° now executes its financial enrichment for **12 selected accounts instead of 365 candidates**. The fresh local benchmark shows approximately **58% lower median HTTP latency** at concurrency 1 and 57% lower at concurrency 4. All selected data and ordering remain identical. The conventional reference backend is still faster.

## Method and artifacts

The baseline already includes predicate pushdown. Both runs use the unchanged deterministic medium seed: **756,804 documents** in four tenants, the same business snapshot, database indexes, resource definitions, queries, reference backend, and HTTP benchmark harness. The baseline completed before rebuilding with native pagination scheduling. Each run creates and cleans up its own private MongoDB instance.

Both runs use twelve samples per backend/workload/concurrency, two warmups per backend/workload, and concurrency 1 and 4. That produces **288 timed responses per run**, 576 total. Each run also checks all six views in the first and last tenants before timing. The twelve expected result digests match between runs, every timed response matches its expected digest, and the complete-history budget diagnostic is unchanged.

Environment: Node 24.14.0, MongoDB 8.2.1, AMD Ryzen 5 PRO 3500U, eight logical CPUs, approximately 7.7 GB memory, 0.25 GB WiredTiger cache. Both backends share one Node process and MongoDB pool within each run. These sequential local measurements are exploratory; twelve samples do not establish stable tail latency or statistical significance. Separate executionStats requests run after timing and cover the root aggregation, excluding later application/deferred reads.

Artifacts: [baseline report](native-pagination-before/report.md), [baseline raw data and plans](native-pagination-before/report.json), [updated report](native-pagination-after/report.md), [updated raw data and plans](native-pagination-after/report.json). The earlier [predicate pushdown comparison](predicate-pushdown-comparison.md) records the previous optimization separately.

Commands for the corresponding backend versions:

```sh
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/native-pagination-before
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/native-pagination-after
```

## Account 360° result

Median end-to-end HTTP milliseconds; reference values are from the updated run:

| Concurrency | Adira before | Adira after | Reduction | Speedup | Reference |
| ----------- | -----------: | ----------: | --------: | ------: | --------: |
| 1           |        396.0 |       167.1 |     57.8% |   2.37× |      29.2 |
| 4           |        474.2 |       203.4 |     57.1% |   2.33× |      62.0 |

Root executionStats establish the reduction in actual database work:

| Operation                                          | Parents before → after | Documents examined before → after |
| -------------------------------------------------- | ---------------------: | --------------------------------: |
| Financial order summary                            |               365 → 12 |                       2,184 → 520 |
| Financial line costs                               |               365 → 12 |                     8,736 → 2,080 |
| Displayed manager include                          |                12 → 12 |                           12 → 12 |
| Displayed order include, including its nested work |                12 → 12 |                     2,527 → 2,527 |
| Displayed ticket include                           |                12 → 12 |                           72 → 72 |

The financial lookups use the same foreign indexes, with zero lookup collection scans. The parent page retains enough order/line data that foreign documents examined fall by about 76%, while parent lookup iterations fall by about 97%. Those reductions need not translate proportionally into HTTP latency.

The relevant native order changed from:

```text
Input policy → base filter → id → financial lookups → net revenue
             → complete region filter → sort/limit → display includes
```

to:

```text
Input policy → base filter → id → complete region filter → sort/limit
             → financial lookups → net revenue → display includes
```

No application business logic, MongoDB query implementation, or frontend selection was rewritten to obtain this change. The planner schedules the registered computations automatically.

## Other views

All six views were rerun. Median end-to-end HTTP milliseconds at concurrency 1:

| View             | Adira before | Adira after | Reference after |
| ---------------- | -----------: | ----------: | --------------: |
| Directory        |         13.9 |        14.1 |             6.4 |
| Revenue/margin   |        311.9 |       299.3 |            54.5 |
| Service risk     |        759.8 |       785.0 |            67.5 |
| Account 360°     |        396.0 |       167.1 |            29.2 |
| Order operations |        205.1 |       214.3 |            24.7 |
| Replenishment    |        580.3 |       583.8 |            42.1 |

Concurrency 4:

| View             | Adira before | Adira after | Reference after |
| ---------------- | -----------: | ----------: | --------------: |
| Directory        |         17.7 |        19.5 |            12.6 |
| Revenue/margin   |        357.0 |       364.5 |            98.5 |
| Service risk     |        923.2 |       951.4 |           117.4 |
| Account 360°     |        474.2 |       203.4 |            62.0 |
| Order operations |        268.0 |       260.9 |            77.2 |
| Replenishment    |        694.9 |       680.5 |            60.4 |

The directory, financial, and risk inspections are unchanged between runs. Finance needs its computed revenue before filtering/ordering, and risk needs application-computed scores before its final page. Order operations and replenishment retain their root strategies; some nested display derivations can move behind their own child pages. Small timing differences in either direction for these other views should not be attributed to this optimization without further measurement.

Application work counts remain unchanged: 486 risk scores, 668 order priorities, 356 days-of-cover values; Account 360° still evaluates 12 risk scores and 24 displayed order priorities. Adira command counts remain 1/1/18/5/4/11 across the six views. This change schedules work within an aggregation; it does not add round trips.

## Safety and current limits

The planner delays only a contiguous suffix of recognized repeatable per-parent native derivations/producers when the complete filter, reader scope, and ordering can run before native pagination. Source-input policy stays first. It tracks writes to keep page inputs and field versions correct, preserves multi-output producers atomically, and places delayed relation keys before native includes consume them.

Raw transformations, source filters/sorts, projections, global parent operations, randomness, and parent whole-document reads remain boundaries. Foreign whole-document reads within a lookup are independent of parent planner metadata and can qualify. Whole-parent capture through lookup `let`, implicit-current `$getField`, or temporary writes that could clobber predicate metadata stay early. Existing native workflows remain accepted when scheduling cannot prove safety.

Complete relation reductions retain complete candidates. Application filtering/sorting retains the native prefix; this patch does not introduce a MongoDB continuation after application pagination. The suffix strategy deliberately avoids moving earlier producers around intervening stages. No frontend or backend fluent API or TypeScript inference changes are required.

Account 360° still scans all 6,000 stored accounts to find its 365 base candidates, with zero root index keys examined. It still examines 520 order documents and 2,080 lines for the selected financial summaries, and its displayed order include reports 2,527 documents examined. Its independent later dependency reads and callbacks are unchanged. The result remains about 5.7× slower than the reference at concurrency 1 and 3.3× slower at concurrency 4; root index lowering and query execution strategy remain substantive work.

The history diagnostic still reports 479 complete candidates against a limit of 400, with `ReadBudgetError` and a reference value of 82,862. No partial result is introduced.

## Verification

- `npm run stress:build`: backend/client builds, stress server/frontend type checks, and production Vite build passed.
- `npm run test -w packages/backend`: inference/type tests, native diagnostics, **149 MongoDB integration cases** (18 new native pagination cases), and generated-client checks passed.
- `npm run stress:test`: all **11 dashboard integration cases** passed.
- Both medium runs passed twelve parity comparisons and all 576 timed-result digest checks.
- A dedicated integration test uses MongoDB executionStats to assert that a paginated stock lookup enriches one selected parent.

Implementation: [native scheduling and effects](../../../packages/backend/read/native-effects.ts), [pipeline compilation](../../../packages/backend/read/execute.ts), [pagination regression cases](../../../packages/backend/test/native-pagination.cases.ts), and [producer documentation](../../../docs/native-field-producers.md).
