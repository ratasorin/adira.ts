# Conservative predicate pushdown: before and after

The planner change reduced enrichment work and improved latency on this dashboard corpus. Results and ordering stayed identical. Adira still trails the conventional reference backend, especially where correlated enrichment and separate dependency reads dominate.

## Method

Both runs used the unchanged medium seed: **756,804 documents**, four tenants, the same business snapshot, indexes, resource definitions, frontend queries, reference implementations, and benchmark harness. Each run created its own private MongoDB instance. The baseline completed before rebuilding the backend with the planner change.

- Twelve samples per backend/workload/concurrency, two warmups per backend/workload, concurrency 1 and 4: **288 timed HTTP responses per run**, 576 total.
- Twelve preflight comparisons per run: all six views in the first and last tenants. Every timed response also had to match its expected result digest. All twelve digests match across the before/after runs.
- Node 24.14.0, MongoDB 8.2.1, AMD Ryzen 5 PRO 3500U, eight logical CPUs, approximately 7.7 GB memory, MongoDB WiredTiger cache 0.25 GB.
- Separate executionStats requests ran after timing. They cover only the root native aggregation, not deferred dependencies, callbacks, or subsequent MongoDB commands.
- Both backends share one Node process and MongoDB pool in each run. Memory is process-wide. These sequential local runs are exploratory; twelve samples do not establish stable tail latency or statistical significance. Reference timings also vary between runs. Document/parent counters provide stronger evidence of the work removed than small latency differences do.

Artifacts: [baseline report](predicate-pushdown-before/report.md), [baseline raw data and plans](predicate-pushdown-before/report.json), [updated report](predicate-pushdown-after/report.md), [updated raw data and plans](predicate-pushdown-after/report.json).

The command for each corresponding backend version was:

```sh
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/predicate-pushdown-before
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/predicate-pushdown-after
```

## Latency

Concurrency 1, median end-to-end HTTP milliseconds. The reference column is the updated run's independently implemented fixed-view backend.

| View             | Adira before | Adira after | Reduction | Speedup | Reference |
| ---------------- | -----------: | ----------: | --------: | ------: | --------: |
| Directory        |         14.4 |        13.6 |      5.5% |   1.06× |       6.5 |
| Revenue/margin   |        837.3 |       296.5 |     64.6% |   2.82× |      58.0 |
| Service risk     |      1,285.7 |       735.3 |     42.8% |   1.75× |      67.6 |
| Account 360°     |        968.8 |       367.2 |     62.1% |   2.64× |      28.9 |
| Order operations |        284.3 |       205.2 |     27.8% |   1.39× |      24.1 |
| Replenishment    |        857.0 |       533.1 |     37.8% |   1.61× |      53.9 |

Concurrency 4, median end-to-end HTTP milliseconds:

| View             | Adira before | Adira after | Reduction | Reference |
| ---------------- | -----------: | ----------: | --------: | --------: |
| Directory        |         20.2 |        17.1 |     15.3% |      10.8 |
| Revenue/margin   |      1,010.0 |       442.1 |     56.2% |      76.7 |
| Service risk     |      1,536.9 |       900.9 |     41.4% |     111.5 |
| Account 360°     |      1,148.0 |       439.8 |     61.7% |      65.0 |
| Order operations |        363.4 |       268.1 |     26.2% |      67.1 |
| Replenishment    |      1,034.7 |       690.1 |     33.3% |      69.0 |

Directory has little native enrichment to remove. Its small observed difference should not be treated as a demonstrated optimization benefit. The larger enrichment views also show deterministic reductions in lookup work below.

## What changed in the actual database plans

The new pass adds safe necessary base predicates before independent per-parent native work. The complete original filter remains later in the pipeline. Source-input policy remains first, producers remain atomic, and predicates stop at field overwrites or opaque/stream-wide boundaries. It applies to nested includes and complete relation reductions as well as root reads.

| Root lookup                   | Parents before → after | Foreign documents examined before → after |
| ----------------------------- | ---------------------: | ----------------------------------------: |
| Revenue/margin: order summary |            1,460 → 486 |                             7,264 → 2,618 |
| Revenue/margin: line costs    |            1,460 → 486 |                           29,056 → 10,472 |
| Service risk: order summary   |            1,460 → 486 |                             7,264 → 2,618 |
| Service risk: line costs      |            1,460 → 486 |                           29,056 → 10,472 |
| Account 360°: order summary   |            1,460 → 365 |                             7,264 → 2,184 |
| Account 360°: line costs      |            1,460 → 365 |                            29,056 → 8,736 |
| Replenishment: inventory      |            1,963 → 356 |                               3,926 → 712 |

These lookups continue to use the same foreign indexes, with zero collection scans reported for those lookup stages. The later Account 360° display lookups still process 12 parents. No parent pagination has been moved.

For order operations, the root cursor now outputs 668 rows instead of 29,703 before managed native derivations. It still examines all 120,000 stored orders. This avoids unnecessary native conversions/arithmetic without changing the 668 JavaScript priority evaluations needed for the final 20 rows.

## What remains expensive

1. **Root scans persist.** Account roots still examine 6,000 documents, order roots 120,000, and product roots 8,000, with zero root keys examined. This patch keeps the existing null-aware `$expr` semantics; index-oriented lowering is a separate change.
2. **Display-only enrichment still precedes pagination.** Account 360° enriches 365 accounts to return 12. Moving that work after safe parent pagination would remove another large amount of unnecessary work.
3. **Correlated versus bulk execution is unchanged.** The reference backend groups over the matching account ID set in bulk. Adira's registered finance block still executes per-parent lookups. Its multiple outputs remain one atomic demand, so requesting revenue can retain cost work as well.
4. **Independent dependency reads still do not fuse.** Command counts remain 1/1/18/5/4/11 for Adira's directory/finances/risk/account360/orderOps/replenishment views. Risk still evaluates 486 scores, order operations 668 priorities, and replenishment 356 days-of-cover values. This patch reduces earlier native work, not the complete candidates required by those application filters/sorts.
5. **The complete-history budget remains explicit.** The whale account has 479 candidates against a limit of 400. Both runs report `ReadBudgetError`; the reference calculation remains 82,862. No partial result is introduced.

The next performance targets are index-compatible base/policy predicates, safe pagination before display-only native enrichment, and measured bulk/fused execution of aggregate dependencies. The comparison does not establish which of these wins most without another implementation and benchmark.

## Verification

- `npm run test:read`: backend build, inference/type tests, native diagnostic checks, **131 MongoDB integration cases** (21 new pushdown cases), and generated-client contract checks passed.
- `npm run stress:build`: server/frontend type checks and Vite production build passed.
- `npm run stress:test`: all **11 dashboard integration cases** passed.
- Both medium benchmark runs passed all parity checks and all 576 timed-result digest checks.

The [planner implementation](../../../packages/backend/read/execute.ts), [native effect analysis](../../../packages/backend/read/native-effects.ts), and [regression cases](../../../packages/backend/test/predicate-pushdown.cases.ts) contain the implementation details. The public frontend and backend fluent APIs are unchanged.
