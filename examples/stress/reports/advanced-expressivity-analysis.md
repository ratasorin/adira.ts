# Expanded dashboard stress test

This report records the state **before compatible native reduction fusion**. That optimization is now implemented; the [paired comparison](reduction-fusion-paired/report.md) measures unchanged dashboard queries against the captured previous reader, the new reader and the same native reference. The measurements and diagnosis below remain the historical evidence that motivated it.

Four new dashboards exercise the existing REST resources, with an alternative Adira implementation of fulfillment. The framework API, validation rules and candidate budgets remain unchanged. Backend modeling can remove substantial work, but these implementations **have not reached the optimized native reference's performance**.

The [final measurements](advanced-expressivity-medium-final/report.md), [raw results and command traces](advanced-expressivity-medium-final/report.json), and [audit](advanced-expressivity-medium-final/audit.json) contain the evidence. The earlier [sixteen-sample trial](advanced-expressivity-medium/report.md) is retained separately. The final run adds the batch implementation and changes triage's root order to visit a whale account; the trials are not a before/after performance experiment.

## Queries and implementation choices

| View                    | Frontend demand                                                                                                                                          | Adira backend                                                                                                              | Fixed-view native reference                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Revenue quality         | Nested AND/OR/NOT over count/average/min/max; latest paid order; separately offset order include; displayed margin                                       | Prebuilt native reductions, native first, custom batch revenue/cost and JS margin                                          | One indexed order scan with all accumulators, `$top` and `$topN`; costs only for selected accounts        |
| Fulfillment             | Stock-dependent parent filtering/ranking; filtered lines; product/warehouse includes with computed predicates                                            | Custom native line → stock lookup, prebuilt sum, JS score and warehouse status                                             | One order read, bulk lines, stock shared by distinct products, reused data for includes                   |
| Fulfillment, batched    | Exactly the same request and response contract                                                                                                           | Typed `resolveBatch` shares root stock work across orders; batches of 1,024; the same includes as the first implementation | The same reference endpoint                                                                               |
| Nested triage           | Independent parent/order/ticket offsets; computed order filtering/sorting; margin/shortage filters; four include levels ending in JS warehouse filtering | Native root page, app child ranking, custom native line producer, shared manager callback                                  | Native priority expression, per-account `$topN`, bulk lines/products/stock and parallel independent reads |
| Portfolio concentration | Cross-account shares and manager concentration mixed with an approved relation predicate inside OR/NOT                                                   | Typed batch grouping by manager/account, JS ratios, native ticket-existence preparation                                    | One shared order grouping supplies both account and manager totals; bulk escalation tickets               |

Requests are in [advanced-workloads.ts](../harness/workloads/advanced.ts). Compare [adira.ts](../server/accounts/details.adira.ts), [native-fields.ts](../server/orders/shortages.adira.ts), and [metrics.ts](../server/accounts/revenue.provider.ts) with [reference-advanced.ts](../server/accounts/revenue-quality.reference.ts). The references use ordinary MongoDB/JavaScript and share business formulas, without using Adira execution or query translation.

The shortage metric tests each line against current policy-approved stock; it does not allocate stock among competing orders. Portfolio denominators use all policy-approved orders for the selected managers, independently of the displayed account subset. Both implementations use those same definitions.

## Measured results

Local HTTP medians in milliseconds; 756,804 documents, four tenants, MongoDB 8.2.1, Node 24.14.0, 256 MB WiredTiger cache. Each cell has 24 measured requests, following two warmup rounds. Engine order rotates between request waves, without running different engines concurrently. Concurrency is a fixed wave of requests, rather than a sustained arrival-rate load test.

| New view / implementation       | Adira c=1 | Native c=1 | Adira c=4 | Native c=4 | Commands Adira / native |
| ------------------------------- | --------: | ---------: | --------: | ---------: | ----------------------: |
| Revenue quality                 |     283.9 |       63.5 |     355.1 |      101.6 |                  22 / 5 |
| Fulfillment, composed relations |   2,797.0 |      134.8 |   3,102.1 |      423.7 |                  52 / 5 |
| Fulfillment, custom batch       |     363.7 |      134.8 |     767.1 |      423.7 |                  48 / 5 |
| Nested triage                   |     113.4 |       16.5 |     139.4 |       30.2 |                  13 / 8 |
| Portfolio concentration         |     307.5 |       44.4 |     392.0 |       79.2 |                  15 / 5 |

The custom fulfillment implementation is **7.7× faster** than the relation-based implementation at concurrency 1, while remaining **2.7× slower** than the reference. At concurrency 4, it is 4.0× faster than the relation implementation and 1.8× slower than the reference. This compares two valid application models, including a batch-size change; it does not isolate batching as the only cause.

All ten dashboards passed parity for the first and last tenants: 20 tenant/workload sets, with two additional comparisons for the batch implementation. All **1,008 measured responses** matched the expected complete JSON digest, including nested ordering and numeric values. Twenty-four samples give exploratory latency estimates; tail measurements need larger runs. System load rose from 3.18 to 5.16 during the run on an eight-logical-CPU machine. The within-run comparisons and work counters are more useful than comparisons with old reports.

All inspected Adira root cursors used existing indexes. Root index absence does not explain these gaps. Root `executionStats` excludes deferred commands; the separate untimed traces capture those commands for every implementation. Driver durations may overlap, and returned counts are intermediate result rows rather than documents examined. Process memory includes every implementation and the load generator.

## Where the work goes

### 1. Several efficient reductions still repeat the same scan

The quality planner correctly selects `mongodb / bulk` for count, average, minimum and maximum. Each scans the same paid/shipped 90-day order relation independently, for each parent batch:

```ts
.load("recentOrderCount", orders.count({ where: paidWindow }))
.load("recentOrderAverage", orders.avg({ field: "netCents", where: paidWindow }))
.load("recentOrderMin", orders.min({ field: "netCents", where: paidWindow }))
.load("recentOrderMax", orders.max({ field: "netCents", where: paidWindow }))
```

There are 486 candidate accounts, four batches and **16 reduction aggregations**, followed by latest-order, revenue, cost and include reads. The trace totals 22 commands. The reference supplies all reductions, latest order and top orders from one grouped order scan, plus the selected accounts' cost query: five commands including cursor continuations.

Revenue, cost and margin already run only for the selected 20 accounts. This gap remains after fixing avoidable source-stage ordering. A developer can hand-fuse the fixed statistics in a custom batch summary; automatic fusion of compatible prebuilt demands is missing. Independent loads also execute sequentially. Running four scans concurrently would retain their duplicate database work.

### 2. Native composition does not imply shared database work

The straightforward fulfillment implementation composes these operations:

```ts
const lines = scopedLines.native({
  provides: ["shortageUnits"],
  requires: ["productId", "tenantId", "quantity"],
  stages: shortageStages, // lookup stock, compute shortage, remove temporary data
  output: schema.object({ shortageUnits: schema.number() }),
});
// Bind lines to orders, then:
.load("shortageUnits", fulfillmentItems.sum({ field: "shortageUnits" }))
.derive("fulfillmentScore", ["priority", "shortageUnits"], computeScore)
```

The sum stays native, but inspection explains its strategy as **parent-scoped: opaque native child stages**. There are 1,195 candidate orders and 4,780 lines. Ten root-reduction commands repeatedly run the stock lookup inside those line pipelines; a further line query resolves selected includes. The reference reads stock for **1,823 distinct products** and reuses it.

The alternative uses a normal typed custom relation:

```ts
const summary = batchedOrderBase
  .related({
    requires: ["_id"],
    output: shortageOutput,
    resolveBatch: loadOrderShortages,
  })
  .one(ShortageSummary);

const source = batchedOrderBase
  .load("shortageSummary", summary.get({ select: { shortageUnits: true } }))
  .derive(
    "shortageUnits",
    ["shortageSummary"],
    (row) => row.shortageSummary?.shortageUnits ?? 0,
  );
```

Its two invocations process all 1,195 orders and 4,780 lines, with 2,312 distinct-product demands summed across those batches. Original parent references preserve association; schemas check the summary. The frontend query, includes, scopes and budgets are unchanged. This confirms that backend freedom already fixes a large part of the root cost. The framework does not derive this shared strategy automatically from the original native block.

### 3. Nested application filtering can produce many small reads

Both Adira fulfillment implementations still issue **37 separate inventory aggregations** for displayed product/warehouse includes. The batch implementation's other two inventory aggregations compute root summaries, for 39 inventory aggregations total. Repeated association paths can revisit products, and a JS `stockStatus` filter requires application membership before each child page.

The batch implementation therefore still executes 48 commands. Its selected line producer retains a native stock lookup as well. The reference reuses its stock data and performs five total commands. Fewer root computations alone cannot remove these include costs. The trace demonstrates a concrete N+1 pattern across nested include boundaries; `.toApp({ concurrency: 8 })` does not create request-wide relation batching.

Triage shows the same pressure on a smaller result. Adira evaluates JS priority for **164 orders** and returns five displayed orders across 12 accounts. It runs eight inventory aggregations. The reference computes priority before native per-account top-N and reads the selected lines/stock in bulk. An order's native priority expression can be supplied by an application author; arbitrary JavaScript functions still need an efficient application strategy.

### 4. Sharing is limited to each batch and each declared computation

Portfolio concentration processes the same 486 account candidates in both implementations. Adira deduplicates managers inside each custom invocation, but its four invocations sum to **138 manager demands**; the reference groups the **100 unique managers** once. Adira also scans account revenue separately from manager revenue, while the reference reuses the same grouped results.

The approved `hasRecentEscalation` predicate composes correctly inside the mixed Boolean tree. Its native preparation uses per-account ticket lookups; the reference fetches the escalation set in bulk. Both manual bulk preparation and shared revenue summaries could be written using existing backend APIs. Generic demand fusion, request-scoped reuse and overlap of independent loads are still absent. The 15-versus-five command count is only part of the cost: commands containing correlated lookups can perform much more work.

## Expressivity and DX findings

The frontend successfully combines deep Boolean trees, native and JS fields, filter-only and order-only inputs, nullable reductions, an approved relation predicate, four include levels and independent relation pages. Complete backend statistics stay independent of displayed child pages. Native producer types and custom batch outputs feed later callbacks without manual row casts.

[Runtime probes](../harness/workloads/rejections.ts) and [frontend compiler probes](../tests/types/frontend.ts) establish these boundaries:

| Request                                              | Current behavior                | Implication                                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arbitrary `orders.$some(...)` root condition         | Rejected                        | Backend must expose an approved predicate such as `hasRecentEscalation`. Controlled relation predicates work; arbitrary quantifiers are unavailable.                 |
| Two aliases of `orders` with different filters/pages | Rejected                        | Declare two relation names or make separate requests. This makes dashboard composition less convenient.                                                              |
| `recentOrderAverage({ since: ... })`                 | Rejected                        | Computed inputs are fixed by the backend. Frontend include windows can vary, while this computed field's window cannot. Typed backend-declared arguments would help. |
| Frontend `groupBy`                                   | Rejected                        | Intentional resource-contract boundary, retained.                                                                                                                    |
| String operand for a Boolean named predicate         | Rejected before database access | Type and runtime validation agree.                                                                                                                                   |

Every rejected probe returns HTTP 400 with zero database commands. The server inference fixture also verifies that `resolveBatch` receives typed parent requirements and context, **without query intent**. A custom provider cannot directly inspect selection, filtering, ordering or pagination to push that work into its own data source. This is a real boundary when returning complete candidates is expensive; it was unnecessary for the fixed-size shortage summary.

The budget diagnostic requests two priority-ranked orders from a whale's 90-day history. The reference computes the exact two results from **479 candidates**. Adira rejects the request at its **400-candidate budget**, even though the response page is small. This protects correctness through an explicit `ReadBudgetError`; supporting large computed child pages efficiently still requires a native implementation, another backend algorithm, or a different execution strategy. Raising the budget only permits more materialization.

TypeScript and output schemas enforce shapes. Developer-owned MongoDB stages and raw queries still carry responsibility for business semantics, tenant policy and row-preservation promises. The custom batch implementation targets the declared scalar foreign-key models; the benchmark does not prove equivalence for arbitrary malformed MongoDB documents.

## What to improve next

1. **Batch deferred work across nested parents.** The 37 inventory reads survive the large root optimization and directly demonstrate a library scheduling problem. Preserve per-parent filtering/order/page and scope while grouping compatible tasks across the include level.
2. **Fuse compatible native reductions.** Count/avg/min/max over identical membership can share one validated bulk group. This directly targets the 16 scans in quality without requiring every backend author to write a custom summary.
3. **Reuse pure demands across a request.** Shared manager/product keys and overlapping summary inputs repeat across batches. Reuse must include policy, parameters, context and purity in its identity; arbitrary callbacks should not be assumed cacheable.
4. **Give custom providers validated query intent and deliberate pushdown capabilities.** Keep final membership/shape enforcement, rather than assuming a provider silently honored a filter or limit. Typed arguments and relation aliases address separate frontend DX gaps.

Application workarounds already available: write batch summaries for expensive opaque native chains; put membership computations before display-only enrichment; provide native equivalents for portable computed fields; bundle truly shared scans inside one provider. These choices improve performance, but asking every developer to rediscover them weakens the promise of intuitive composability.

## Validation and reproduction

Passed: **171 backend MongoDB integration tests**, backend positive/negative TypeScript fixtures and native diagnostics, the generated Express/client contract test, **27 demo integration tests**, server/frontend TypeScript builds and Vite. New checks cover nullable empty reductions, deterministic first/include ties, complete statistics versus include offsets, stock correlation, missing inventory, tenant/soft-delete isolation, batch pruning and the same public types across both order implementations. The native priority formula is checked against the JS business rule on 50 representative inputs.

```sh
npm run stress:build
npm run test -w packages/backend
npm run stress:test
npm run stress:bench -- --profile medium --iterations 24 --warmup 2 --concurrency 1,4 --explain --output reports/advanced-expressivity-medium-final
```

The runner owns and removes its temporary MongoDB database. The final report stores source hashes, full selected-result digests, raw timings, plans, command traces, expressivity failures, index definitions, environment and budget results. The audit verifies the eight recorded source hashes and all 42 groups of 24 measured samples. A final formatter pass changed only line breaks in `metrics.ts`; its [measured source](advanced-expressivity-medium-final/metrics-measured.ts.txt), both hashes and unchanged TypeScript syntax tree are recorded in the audit. Server/frontend type checks passed again after formatting. To inspect the app, run `npm run stress:demo -- --profile medium`, select a new dashboard, and use **Compare batch implementation** on fulfillment to try the alternative through the same query editor.
