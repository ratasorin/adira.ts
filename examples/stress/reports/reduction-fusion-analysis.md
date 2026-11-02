# Compatible native reduction fusion

The planner now combines compatible native `count`/`sum`/`avg`/`min`/`max` loads into one aggregation per parent batch. Backend declarations, frontend queries, indexes, batch sizes and candidate limits are unchanged. The [paired results](reduction-fusion-paired/report.md), [raw samples and command traces](reduction-fusion-paired/report.json) and [audit](reduction-fusion-paired/audit.json) record the comparison.

## Measured result

The revenue-quality dashboard requests four statistics over the same paid/shipped order window. Previously each statistic scanned that relation independently. The new execution groups all four in one MongoDB `$group` per account batch.

| Revenue quality               |   Before |    After |                                                     Native reference |
| ----------------------------- | -------: | -------: | -------------------------------------------------------------------: |
| HTTP p50, concurrency 1       | 298.3 ms | 139.1 ms |                                                              68.0 ms |
| HTTP p95, concurrency 1       | 306.5 ms | 163.8 ms |                                                             112.0 ms |
| HTTP p50, concurrency 4       | 368.7 ms | 184.3 ms |                                                             103.0 ms |
| HTTP p95, concurrency 4       | 418.0 ms | 194.3 ms |                                                             108.9 ms |
| Commands per request          |       22 |       10 |                                                                    5 |
| Native reduction aggregations |       16 |        4 | One shared order aggregation supplies statistics and other consumers |

This is a **53.4% reduction in median latency** at concurrency 1 and **50.0% at concurrency 4**. Inspection reports one membership group:

```ts
{
  loads: [
    "recentOrderCount",
    "recentOrderAverage",
    "recentOrderMin",
    "recentOrderMax",
  ],
  phase: "membership",
}
```

There are still 486 candidate accounts and four parent batches. The command trace contains four fused order aggregations, followed by separate latest-order, revenue and displayed-order reads: seven order aggregations total, down from nineteen. The account read, its cursor continuation and the selected accounts' cost read account for the other three commands.

Revenue and costs still run for exactly **20 selected accounts**, with one callback invocation each. Margin runs 20 times and displayed priority runs 15 times, identical to the captured old executor. The optimization does not pull those display computations ahead of pagination.

All other workloads keep their command counts. Their before/after medians vary in both directions; those variations should not be attributed to this feature. Fulfillment stays at 52 commands and approximately 2.81 seconds at concurrency 1. Its expensive opaque child pipeline is outside this optimization.

## API and execution boundaries

Existing consecutive `.load()` declarations automatically benefit. There is no new backend or frontend query syntax. The compiler works from retained demands, so selecting only count still computes only count. Numeric fields can differ when their native derivations can be combined without changing validators or field versions.

Compatibility requires the same relation binding, parsed membership and captured policies. Intervening application work, a different binding/filter, output overwrites and dependencies on earlier load outputs end a group. Membership loads and display loads are considered separately, preserving pagination placement. Input policy, reader scope and predicate factories are not invoked again to compile the combined selection.

Opaque pipelines, application providers and unsupported native validators keep their current strategies. Existing runtime guards also remain: ObjectId parent keys use bulk correlation; unsupported scalar or array-valued parents fall back to the original individual execution. Foreign arrays are deduplicated per parent key. Each demanded result retains its validation; empty count/sum results remain zero and empty average/min/max results remain null.

Inspection exposes `reductionGroups`, each member's `fusedWith`, and compatibility explanations in `fusionReason`. See the [execution guide](../../../docs/bulk-reductions-and-load-scheduling.md) for the exact implemented subset.

## Why the native reference remains faster

At concurrency 1, Adira still takes 139 ms versus native's 68 ms. The [native quality query](../server/accounts/revenue-quality.reference.ts) combines statistics, revenue, latest order and the displayed top orders in a single order scan using `$group`, `$top` and `$topN`. Adira combines the four eligible scalar reductions, retains its bounded four account batches and keeps those other consumers separate.

This change does not share work between application providers and native dependencies, combine independently paged includes, reuse results across batches or overlap independent loads. Each needs its own execution/validation rules. Increasing batch size can reduce the number of fused scans through the existing API, with the corresponding memory and query-size tradeoff; this benchmark keeps the existing value of 128.

The other large bottlenecks remain: nested include batching, repeated stock work inside opaque pipelines, shared-manager work across batches, and the existing candidate budgets. Fulfillment, triage and portfolio results remain evidence for those gaps rather than evidence against scalar fusion.

## Verification and measurement

- All **179 backend integration tests** pass, including eight new fusion scenarios for all five operations, different native fields, invalid/non-finite BSON, empty/null inputs, foreign-array correlation, compatibility barriers, pagination and policy factory reuse.
- Backend TypeScript tests check exact intermediate `PlanRow` types, nullable aggregates, selected response inference and negative cases. Native diagnostic and generated Express/client contract tests pass.
- Server/frontend TypeScript builds and all **27 dashboard integration tests** pass. The quality regression assertion verifies the membership group and display callback counts.
- A private medium seed contains **756,804 documents**. All three executors agree for the first and last tenants in each of ten dashboards. All **720 timed responses** match the parity digest.
- Each variant has 12 samples at concurrency 1 and 12 at concurrency 4, after two warmups. Variant order rotates after every request wave; builds and tests do not run during timed measurements. Plans and full command traces are captured afterward.
- This is a warm-cache local benchmark on Node 24.14.0 / MongoDB 8.2.1, sharing a Node process and database pool. Twelve samples are exploratory, especially for tails; the report records machine load and raw observations.

The [benchmark runner](../harness/benchmarks/fusion.ts) compares captured/current modules and the native reference through the same HTTP wrapper. It verifies unchanged demo source hashes. Snapshot capture and invocation are documented in the [demo README](../README.md). The original measurements that motivated fusion remain in the [expanded stress analysis](advanced-expressivity-analysis.md).
