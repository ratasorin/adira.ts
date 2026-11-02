# Bulk reductions and independent loads

Status: **bulk native count/sum/avg/min/max execution and compatible reduction fusion are implemented; independent load scheduling remains a proposal**. The [paired fusion benchmark](../examples/stress/reports/reduction-fusion-paired/report.md) compares the captured previous reader, the new reader and the native reference with unchanged dashboard declarations and queries. The [numeric and demo comparison](../examples/stress/reports/numeric-and-demo-query-comparison.md) separates the earlier numeric extension from explicit application query rewrites. `.exists()` retains its per-parent short-circuit strategy.

The earlier [ROI experiment](../examples/stress/reports/query-roi-analysis.md) measured existing-API backend rewrites: bulk counts accounted for most of a Service Risk reduction from 721 to 290 ms, while manually bundled parallel bulk inputs with a larger batch approached the native reference for that query. That experiment left the production primitives and scheduler unchanged. The implemented strategy below retains independent field-demand granularity; no manual callback bundle is needed.

## Bulk count and numeric reductions

Keep the backend API and frontend contract unchanged:

```ts
source
  .load(
    "openTicketCount",
    tickets.count({
      where: { status: { $in: ["open", "pending"] } },
    }),
  )
  .load(
    "paidRevenue",
    orders.sum({
      field: "netCents",
      where: { status: { $eq: "paid" } },
    }),
  );
```

Eligible count/sum/avg/min/max dependencies group matching children for a parent batch together. The existing parent-scoped lookup/reduction remains the fallback whenever eligibility cannot be proved. Other operations keep their existing native/application strategies.

For a simple scalar relation, the conceptual query becomes:

```ts
[
  {
    $match: {
      accountId: { $in: accountIds },
      // Compiled exact source policy and approved child filter also apply.
    },
  },
  { $group: { _id: "$accountId", value: { $sum: 1 } } },
];
```

For numeric reductions, the compiler reuses each existing native accumulator, including null and invalid-value handling. Average uses MongoDB's existing `$avg` accumulator rather than a new sum/count implementation. It captures original correlation privately before public transformations and retains it through managed projections and overwritten fields. MongoDB grouping is an internal implementation detail; frontend capabilities are unchanged.

### First eligible subset

- A shared MongoDB child source with complete native membership and a scalar parent join key. Start with ObjectId keys to avoid introducing new string-collation or cross-BSON numeric-key assumptions.
- Original correlation can be retained independently of payload transformations. Source policies execute on original child input, before computations that could hide an unauthorized input.
- Retained child work consists of managed derivations, filters, projections and sorting, with repeatable expressions that do not inspect the whole row or private metadata. It has no required application work or opaque native stages. Retained custom native blocks/producers and predicate-preparation pipelines keep parent-scoped execution, including limits, grouping and window functions. Unused derivations or producers remain pruned.
- Aggregate values and retained validators have existing equivalent native validation. Custom parsing/transformation callbacks keep their current fallback.
- Neither display pagination nor an early candidate cap truncates complete reduction inputs. Existing empty-result defaults and invalid-input failures remain intact.

The compiler decides this from retained operation/effect metadata. It does not guess that an arbitrary raw pipeline is interchangeable with bulk grouping.

Missing/null parent keys produce the existing empty-relation result without a child read. Parent keys are deduplicated and each grouped result is mapped back to every parent sharing its key. Runtime batches with any non-ObjectId scalar or array-valued parent key use the existing parent-scoped strategy. Array-valued foreign keys are normalized and deduplicated against requested keys, so a child contributes once to each matching parent. The scalar fast path avoids intersecting the whole parent-key set for every child. A TypeScript/Mongoose scalar declaration alone does not prove stored data is scalar.

Every retained value validation still runs for the same matched child inputs. Each group carries the existing native `invalid` aggregate, and both native strategies share result validation. Absent count/sum groups become zero. Average/minimum/maximum return null for missing groups or all-null inputs. Nullable handling, malformed/non-finite input rejection and finite output checks remain in effect.

Keep this bounded by the existing parent batch; the result contains at most one aggregate per distinct key. Separate parent batches still mean separate queries. This change alone does not aggregate all request candidates at once or share work across requests.

### Sharing compatible reductions

Consecutive eligible `.load()` stages over the same relation binding, exact policy/filter and parent inputs now share one aggregation. The API stays the same:

```ts
source
  .load("paidCount", orders.count({ where: paidWindow }))
  .load("paidTotal", orders.sum({ field: "netCents", where: paidWindow }))
  .load("paidAverage", orders.avg({ field: "netCents", where: paidWindow }))
  .load("paidMinimum", orders.min({ field: "netCents", where: paidWindow }))
  .load("paidMaximum", orders.max({ field: "netCents", where: paidWindow }));
```

For each parent-key batch, the conceptual shared reduction is:

```ts
{ $group: {
  _id: "$accountId",
  count: { $sum: 1 },
  total: { $sum: "$netCents" },
  average: { $avg: "$netCents" },
  minimum: { $min: "$netCents" },
  maximum: { $max: "$netCents" },
  // Preserve the required validation for each demanded result.
} }
```

The actual query retains each operation's nullable-input handling and required validation. Shared checks are computed once. The compiler unions required native fields and retains their derivations and field versions; different numeric fields can share a scan. It reuses captured policy and predicate conditions rather than invoking user factories again.

Fusion runs after demand pruning, separately for membership work and display work. It never pulls display-only work before pagination to join a membership reduction. A derivation, map, filter, batch callback, noneligible load, output overwrite or dependency on a prior load ends the compatible run. Different relation binding instances, filters or captured policies also end it. Opaque native pipelines and application providers keep their existing strategies. This conservative first implementation does not move compatible reductions across unrelated loads or share scans across parent batches.

Every fused result is still validated, including all member checks, finite outputs and private correlation. Empty count/sum results stay zero; empty averages/minima/maxima stay null. Unsupported runtime parent keys fall back to the original individual strategies for that batch. Unrequested reductions are pruned and do not add validators or stages.

### Types and diagnostics

`count()` and `sum()` remain `number`; `avg()`/`min()`/`max()` remain `number | null`. Numeric-field constraints, `requires`, resource compatibility, typed context, and selected response inference remain unchanged. The internal result map and runtime BSON/number validation do not widen public types.

`.inspect()` retains `strategy: "mongodb" | "application"` and adds `execution: "bulk" | "parent-scoped"` for native dependencies. Opaque child work includes a fallback reason. `"bulk"` is the preferred plan, subject to the runtime parent-key guard above. Its inspected pipeline is the reduction body; execution prepends the batch-specific join match and private key capture, just as parent-scoped execution supplies its lookup wrapper.

`reductionGroups` shows each shared body's `loads`, `phase` (`"membership"` or `"output"`) and `pipeline`. A grouped dependency lists its siblings in `fusedWith`; an ungrouped dependency has a `fusionReason`. Individual dependency pipelines remain available for understanding the original operation. The grouped body is the one used when the runtime bulk guard succeeds.

## Overlap independent, safe loads

Start with **consecutive load stages already retained in the plan**. Do not initially move loads across derivations, maps, filters, batch transformations, pagination, or opaque callbacks.

For the risk page the graph is:

```text
account read + revenue load/derivation
  ├─ openTicketCount (_id)
  ├─ lateShipmentCount (_id)
  └─ exposure (_id)
       ↓ all three ready
     riskScore
       ↓ filter / sort / page
     riskBand
```

The three loads read `_id` and write different fields. They can share one immutable snapshot of the current parent batch and be scheduled together if their execution effects permit it. Validate all results, then attach them in registration order to new parent rows. A failed load fails the read; no partial response is returned.

The planner must check read/write hazards as well as effects. A later load requiring an earlier load's output stays after it. Writes that overwrite another load's input or output are a conservative boundary. Shared read dependencies are fine. Use original field versions, not just a flat set of names after transformations.

Run parallel groups with a separate bounded load concurrency. The current `.toApp({ concurrency })` bounds per-row callbacks and should retain that meaning. Cancellation/cleanup and open cursor handling need the same care as ordinary execution; Promise.all alone does not cancel sibling work after a rejection.

### Which operations are safe?

Auto-classify supported deterministic, read-only built-in reductions whose execution does not involve user callbacks. Unknown native work and custom `resolveBatch` loaders remain ordered by default. Declared field dependencies do not prove an arbitrary callback is reorderable: it can also observe shared context or external effects.

For custom loaders, a small explicit promise is preferable to a new collection of execution methods. One possible syntax, **not implemented**, is:

```ts
source.related({
  requires: ["_id"],
  output: ExposureSchema,
  parallelSafe: true, // Proposed: independent of sibling execution order.
  resolveBatch: loadExposure,
});
```

That promise means the callback's declared inputs are complete and it may overlap other independent safe loads using the same context. Shape validation and TypeScript still work as today; neither can prove effects/purity of arbitrary code. Existing callbacks need no annotation and retain their current ordering. A typed isolated field snapshot prevents sibling outputs from becoming accidentally visible mid-group, but does not deep-freeze services or make external code pure.

Initially the two native counts could overlap, while exposure remains ordered until explicitly opted in. This avoids silently changing the semantics of existing custom callbacks. `.inspect()` should expose parallel groups and barriers so developers can see the chosen execution.

## Expected limits and implementation order

Bulk reduction eligibility/execution and compatible fusion are implemented and covered by integration, type and dashboard parity tests. Parallel groups of safe adjacent loads remain a separate proposal. Add custom opt-in only with tests for context/effect ordering, field overwrites, failures/cleanup, and nested execution limits.

Neither numeric grouping nor future load scheduling automatically rewrites arbitrary native blocks. The stress app now explicitly uses typed `resolveBatch` providers for revenue, costs and stock totals through the same relation API. Revenue and costs remain independently demand-pruned; stock amounts and warehouse count deliberately share one grouped read. Existing 128-parent batching and sequential load execution remain. Matching the reference's whole-request strategy still requires evidence about scheduling, nested includes and compatible demand sharing.
