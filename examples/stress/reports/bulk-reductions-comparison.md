# Automatic bulk native count/sum execution

Eligible `.count()` and `.sum()` dependencies now group matching children across a parent batch. Public declarations, type inference and validation remain intact. Opaque native pipelines, including per-parent limits/grouping, retain their existing execution strategy. No application query, index, resource, callback, batch size, reference endpoint or load scheduling was changed for this comparison.

## Method and correctness

Fresh before/after HTTP runs use the deterministic medium seed: **756,804 documents**, four tenants, the same business snapshot and indexes. Each run uses a private MongoDB instance with a 0.25 GB WiredTiger cache. There are twelve samples per backend/view/concurrency, two warmups, and concurrency 1 and 4: **288 timed responses per run, 576 total**. No build/test process runs alongside timing.

All twelve first/last-tenant result digests match between runs. Every timed response matches its expected result, including ordering. Seed parameters, collection counts, indexes, root pipelines, callback counts, driver command counts and complete-history budget outcomes match. The root native pipeline is unchanged for every view; the optimization changes deferred count/sum execution.

Environment: Node 24.14.0, MongoDB 8.2.1, AMD Ryzen 5 PRO 3500U, eight logical CPUs, about 7.7 GB memory. Both backends and the HTTP load generator share one Node process and database pool. Sequential local runs with twelve samples are exploratory measurements; they do not establish production capacity or eliminate machine/cache variability.

Artifacts: [before report](bulk-reductions-before/report.md), [before raw data/plans](bulk-reductions-before/report.json), [after report](bulk-reductions-after/report.md), [after raw data/plans](bulk-reductions-after/report.json), [audited comparison data](bulk-reductions-comparison.json).

```sh
npm run stress:build
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/bulk-reductions-before
# Rebuild with the bulk executor, then:
npm run stress:build
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/bulk-reductions-after
```

Run the first benchmark against the preceding executor. The recorded baseline already includes index lowering and the independent cost producer.

## Median HTTP latency

Concurrency 1, milliseconds; negative change means faster:

| View             | Adira before | Adira after | Change | Reference before | Reference after |
| ---------------- | -----------: | ----------: | -----: | ---------------: | --------------: |
| Directory        |          9.6 |        12.0 | +25.1% |              6.7 |             6.6 |
| Revenue/margin   |        176.7 |       180.2 |  +2.0% |             58.5 |            58.1 |
| Service Risk     |        735.6 |       330.6 | -55.1% |             63.4 |            65.7 |
| Account 360°     |        166.0 |       164.1 |  -1.1% |             30.6 |            29.6 |
| Order operations |        132.1 |       119.9 |  -9.3% |             24.3 |            24.2 |
| Replenishment    |        509.3 |       202.2 | -60.3% |             43.8 |            42.4 |

Concurrency 4:

| View             | Adira before | Adira after | Change | Reference before | Reference after |
| ---------------- | -----------: | ----------: | -----: | ---------------: | --------------: |
| Directory        |         19.1 |        18.7 |  -2.1% |             10.4 |            11.0 |
| Revenue/margin   |        217.3 |       212.6 |  -2.2% |             84.3 |            91.0 |
| Service Risk     |        890.2 |       404.0 | -54.6% |            121.8 |           103.4 |
| Account 360°     |        195.4 |       228.8 | +17.1% |             67.0 |            65.9 |
| Order operations |        155.0 |       185.3 | +19.5% |             63.7 |            69.1 |
| Replenishment    |        617.0 |       258.4 | -58.1% |             61.3 |            62.2 |

Service Risk is approximately **2.22× faster** and Replenishment **2.52× faster** at concurrency 1. Their p95 values fall from 832.0 to 392.0 ms and 619.1 to 350.5 ms. At concurrency 4 the median improvements remain approximately 55% and 58%.

Other views show mixed results. Account 360° only evaluates twelve accounts, so bulk counts do not remove its main costs; its concurrency-4 median worsens by 17%. Order operations has unchanged execution plans and worsens by 20% at concurrency 4. These regressions are retained. Timing variation in unchanged work prevents attributing every movement to the optimization; no universal speedup is claimed.

## Execution changes

| View          | Dependencies now using bulk execution       | Parent contexts per dependency |
| ------------- | ------------------------------------------- | -----------------------------: |
| Service Risk  | `openTicketCount`, `lateShipmentCount`      |                            486 |
| Account 360°  | `openTicketCount`, `lateShipmentCount`      |                             12 |
| Replenishment | `unitsSold` (sum), `warehouseCount` (count) |                            356 |

With the existing 128-parent batch size, Risk previously used eight scaffold commands containing 972 independent child lookups/reductions; it now uses eight direct grouped child queries. Replenishment replaces 712 child lookups/reductions with six grouped queries. Account 360° replaces 24 child lookups/reductions with two grouped queries. These logical counts follow from the retained loads, inspected candidate counts and batch sizes; root executionStats does not measure deferred queries.

Total measured commands remain **18 for Risk**, **11 for Replenishment**, and **5 for Account 360°**. The improvement is reduced work within commands. Mean summed Mongo driver durations at concurrency 1 fall from 693.8 to 287.8 ms for Risk and 519.2 to 185.0 ms for Replenishment. These are summed driver durations, not MongoDB CPU counters.

Risk still computes 486 JavaScript scores and makes four exposure-provider calls. Replenishment still computes 356 days-of-cover values. Raw revenue and inventory producers, root index access and pagination stay unchanged. Count/sum loads remain independently demand-pruned and execute sequentially; no query fusion or independent-load concurrency was added.

## Safety and validation

The compiler requires supported managed native operations and exact native membership/validation. It retains the original join key privately through projections and overwrites. Runtime scalar ObjectId keys are deduplicated; grouped values are associated with every parent sharing a key. Foreign arrays are deduplicated against requested keys, while scalar foreign keys avoid a batch-wide intersection. Missing groups produce zero.

Non-ObjectId or multikey parent batches use the existing parent-scoped path. Raw native blocks, limits, grouping, windows, custom predicate preparation and whole-row/nonrepeatable expressions remain conservative. Application membership and custom parsers retain their application fallback. Both native paths share invalid-input and aggregate-result validation, including malformed/non-finite values, nullable inputs and output overflow.

Inspection preserves `strategy: "mongodb" | "application"` and adds native `execution: "bulk" | "parent-scoped"`. Bulk is the preferred plan subject to the runtime key guard; opaque work includes a fallback reason. No query-language or backend declaration changes are required.

Validation: **169 MongoDB integration tests**, compiler and native-diagnostic checks, the generated Express/client bridge test, stress frontend/backend builds and **12 stress integration tests** pass. New cases cover private correlation after actual join-field overwrites/projections, shared/missing keys, malformed stored foreign arrays, nested Boolean filters, native limit/group/facet fallbacks, runtime parent-key fallbacks, key batch limits, aggregate overflow and invalid correlation results. A real executionStats regression confirms a bulk sum uses `IXSCAN`, examines fewer than twenty of over one thousand child documents, and has no per-parent `$lookup`.

## Remaining gap

The native reference remains substantially faster: approximately 66 ms for Risk and 42 ms for Replenishment at concurrency 1. Bulk count/sum does not rewrite the application's opaque revenue/inventory producers, overlap independent loads, fuse compatible demands, or change the batching boundary. Those remain separate opportunities. See the [implementation and scheduling guide](../../../docs/bulk-reductions-and-load-scheduling.md) and the earlier [query ROI experiment](query-roi-analysis.md).
