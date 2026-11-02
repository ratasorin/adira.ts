# Index-compatible base predicates

The compiler now emits necessary ordinary Mongo matches for supported field comparisons while retaining exact expressions. **All six dashboard root cursors changed from `COLLSCAN` to indexed plans using the existing indexes.** Order operations improved substantially; the overall latency results are mixed, including a service-risk regression. This is an index-access improvement, not a replacement for choosing efficient enrichment strategies.

## Method and artifacts

Both fresh runs use the unchanged deterministic medium seed: **756,804 documents**, four tenants, the same business snapshot, resource definitions, frontend queries, indexes, reference implementation, and HTTP harness. The baseline already includes predicate pushdown and native pagination scheduling, and completed before rebuilding with index-compatible predicates. No indexes, hints, business formulas, or backend query implementations were changed.

Each run has twelve samples per backend/view/concurrency, two warmups, and concurrency 1 and 4: **288 timed responses per run, 576 total**. All twelve preflight digests match between runs; every timed response matches its expected digest. Settings, dataset parameters/counts, index definitions, callback counts, database-command counts, and the complete-history budget outcome also match.

Environment: Node 24.14.0, MongoDB 8.2.1, AMD Ryzen 5 PRO 3500U, eight logical CPUs, about 7.7 GB system memory and a 0.25 GB WiredTiger cache. Each run creates and cleans up its own private MongoDB instance. Both engines share one Node process and pool within a run. These are sequential local exploratory measurements; twelve samples do not establish stable tails or statistical significance. The reference also varies between runs, especially order operations at concurrency 4.

Artifacts: [before report](index-lowering-before/report.md), [before raw timings/plans](index-lowering-before/report.json), [after report](index-lowering-after/report.md), [after raw timings/plans](index-lowering-after/report.json). The earlier [starting-query diagnostic](root-index-diagnostic.md) verifies the reference's index use separately; the main harness's saved executionStats cover Adira's root aggregation, excluding later deferred/application commands.

```sh
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/index-lowering-before
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/index-lowering-after
```

## HTTP latency

Median end-to-end milliseconds at concurrency 1; negative change means faster:

| View             | Adira before | Adira after | Change | Reference before | Reference after |
| ---------------- | -----------: | ----------: | -----: | ---------------: | --------------: |
| Directory        |         11.7 |        10.6 | -10.1% |              6.6 |             6.5 |
| Revenue/margin   |        301.8 |       312.4 |  +3.5% |             56.5 |            59.5 |
| Service risk     |        816.0 |       951.6 | +16.6% |             71.3 |            68.4 |
| Account 360°     |        178.0 |       182.5 |  +2.5% |             32.6 |            29.3 |
| Order operations |        205.8 |       118.1 | -42.6% |             25.6 |            22.8 |
| Replenishment    |        616.5 |       524.1 | -15.0% |             45.4 |            47.5 |

Concurrency 4:

| View             | Adira before | Adira after | Change | Reference before | Reference after |
| ---------------- | -----------: | ----------: | -----: | ---------------: | --------------: |
| Directory        |         19.6 |        17.8 |  -9.0% |             11.2 |            12.5 |
| Revenue/margin   |        365.2 |       374.6 |  +2.6% |             85.6 |            86.7 |
| Service risk     |        977.1 |      1064.5 |  +8.9% |            127.0 |           126.1 |
| Account 360°     |        218.9 |       230.9 |  +5.5% |             62.1 |            77.8 |
| Order operations |        277.0 |       173.9 | -37.2% |            140.2 |            60.9 |
| Replenishment    |        704.3 |       657.5 |  -6.6% |             73.2 |            63.9 |

Order operations improved about **43% at concurrency 1** and **37% at concurrency 4**. Its p95 changed from 267.1 to 148.0 ms and 365.5 to 212.1 ms, respectively. Replenishment improved about 15% and 7%. Directory improved modestly, while finance and Account 360° did not improve in these runs. **Service risk regressed about 17% at concurrency 1 and 9% at concurrency 4**; its concurrency-1 p95 changed from 918.1 to 1,105.4 ms. The regression is recorded rather than dismissed as noise or hidden by the index-access improvement.

## Root access actually changed

These are MongoDB root cursor counters, not complete endpoint document counts:

| View             | Root documents examined before → after | Root index keys after | Candidates before → after |
| ---------------- | -------------------------------------: | --------------------: | ------------------------: |
| Directory        |                          6,000 → 1,460 |                   733 |                 486 → 486 |
| Revenue/margin   |                          6,000 → 1,460 |                   733 |                 486 → 486 |
| Service risk     |                          6,000 → 1,460 |                   733 |                 486 → 486 |
| Account 360°     |                            6,000 → 730 |                   365 |                 365 → 365 |
| Order operations |                        120,000 → 1,498 |                   749 |                 668 → 668 |
| Replenishment    |                            8,000 → 712 |                   356 |                 356 → 356 |

The winning plans use the existing compound indexes:

- Accounts: `{ tenantId: 1, deletedAt: 1, region: 1, name: 1 }`.
- Orders: `{ tenantId: 1, deletedAt: 1, region: 1, placedAt: -1 }`.
- Products: `{ tenantId: 1, deletedAt: 1, category: 1, active: 1, sku: 1 }`.

The null policy retains legacy BSON undefined through an indexed OR branch. These winning plans have an inner FETCH for the null branch and an outer FETCH for the exact residual. MongoDB's total document counter sums both layers: for order operations, each reports 749 documents, while the outer layer also reports `alreadyHasObj: 749`. The reported 1,498 is therefore not 1,498 distinct documents or storage reads. The undefined branch returns no seed rows. Keep the raw counters when comparing plans, and inspect their stage structure rather than treating totals as unique row counts. The reference's earlier diagnostic reports 749 documents for its single-FETCH order query.

Necessary matches also flow through the shared compiler into child policies and filters. For example, Account 360°'s displayed ticket lookup changes index choice and reports 70 document visits/59 keys instead of 72/72. This is not a root-only runtime toggle; the same predicate metadata is reused by native relations and reductions.

## Why indexed roots do not close the gap

The selected candidates and business work are unchanged. Risk still scores 486 accounts, order operations 668 orders, and replenishment 356 products. Account 360° still enriches only its 12 selected accounts. Adira still uses 1/1/18/5/4/11 commands across directory/finance/risk/account/orders/replenishment.

Finance and risk still run correlated financial lookups for 486 accounts, examining 2,618 order documents and 10,472 line documents in their root aggregation. Those counts and foreign indexes are unchanged. Account 360° still examines 520 orders and 2,080 lines for financial enrichment, and its displayed order include still reports 2,527 document visits. Replenishment's stock lookup still runs for 356 products and examines 712 inventory documents. Root index access cannot remove these costs or safely page before an application-only score determines ordering.

The service-risk root executionStats report roughly similar complete native aggregation times (401 ms before, 411 ms after) and unchanged financial lookup cardinalities. Its HTTP regression is not explained by those root counters alone. The new matches also alter later dependency queries, which are excluded from the saved root explain. A subsequent [per-command analysis and query-shape probe](service-risk-analysis.md) measures the expensive parent-scoped counts and reproduces some helper-match overhead. It does not fully explain this HTTP run's 17% regression. Bulk aggregate execution and sharing related demands remain separate opportunities; this change does not implement them.

The exact residual and null/undefined branch make the generated plan more involved than the reference's schema-trusting base match. The compiler deliberately preserves existing scalar/null/access semantics rather than changing result behavior to obtain a simpler explain plan. Ordinary scalar predicates can admit arrays; the exact test rejects them before source-policy-protected business work.

## Implementation and verification

- Built-in expressions retain explicit field/necessary-match metadata. Supported positive equality/membership and finite numeric ranges lower to ordinary matches; AND keeps necessary supported branches, OR needs all branches, and approximations are never negated.
- Source policies evaluate once per compilation with the request context and keep their exact check first. Frontend matches reuse existing writer/barrier analysis. Computed, opaque, global, application-only, and unsupported paths retain their existing behavior. No fluent API, public request shape, or TypeScript inference changes are required.
- `npm run stress:build` passed backend/client builds, server/frontend type checks, and the production frontend build.
- `npm run test -w packages/backend` passed inference/type checks, compiler diagnostic checks, **158 MongoDB integration cases** (nine new index-lowering cases), and generated-client checks.
- `npm run stress:test` passed all **11 dashboard integration cases**.
- A regression test demonstrates a selective compound IXSCAN without hints, and another proves an array-valued tenant cannot bypass the exact input policy or reach a failing native expression.
- Both benchmark runs passed twelve preflight comparisons and all 576 timed-result digest checks. The history diagnostic remains 479 candidates against a 400-candidate budget, with `ReadBudgetError` and reference value 82,862; no partial result is returned.

Code: [necessary match construction](../../../packages/backend/read/index-match.ts), [expression metadata](../../../packages/backend/read/expression.ts), [pipeline compilation](../../../packages/backend/read/execute.ts), [backend builders](../../../packages/backend/read/plan.ts), and [regression cases](../../../packages/backend/test/index-lowering.cases.ts). See the [predicate guide](../../../docs/index-predicates.md) for the supported API and semantics.
