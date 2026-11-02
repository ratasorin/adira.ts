# Native field producers

Use `.native({ provides, requires, stages, output })` to attach custom MongoDB computations to field dependencies. Both root and relation builders support it. The existing `.native({ stages, output })` remains an unconditional transform with a replacement output shape.

```ts
const source = mongo.from(Category).native({
  provides: ["stockTotal"],
  requires: ["_id"],
  stages: [
    {
      $lookup: {
        from: Product.collection.name,
        localField: "_id",
        foreignField: "category",
        pipeline: [
          { $match: { isActive: true } },
          { $group: { _id: null, total: { $sum: "$stock" } } },
        ],
        as: "_stock",
      },
    },
    {
      $set: {
        stockTotal: { $ifNull: [{ $arrayElemAt: ["$_stock.total", 0] }, 0] },
      },
    },
    { $unset: "_stock" },
  ],
  output: schema.object({ stockTotal: schema.number() }),
});

type Row = PlanRow<typeof source>; // Category fields plus stockTotal: number.
const Resource = defineResource({
  name: field.string(),
  stockTotal: field.number().filterable("$gte").orderable(),
});
const read = defineRead(Resource, { source });

await read({ select: { name: true } }); // No stock lookup.
await read({ select: { name: true, stockTotal: true } }); // Includes lookup.
await read({ select: { name: true }, where: { stockTotal: { $gte: 10 } } });
// Includes lookup, then filters categories; stockTotal is not returned.
```

The executable [stock/count example](../packages/backend/test/native-producers.fixture.ts) computes two outputs together. `npm run demo:read` prints selection-only, summary selection, and summary filtering queries with their plans and actual results.

Choose producer boundaries around shared work: outputs from one aggregation can stay together, while independent reads should usually be separate producers. Otherwise needing either output activates both reads. The stress app's [revenue/cost split](../examples/stress/reports/split-cost-comparison.md) removes cost work from revenue-only views and lets existing native pagination defer selected margin's costs. Register dependencies before independent display work so a safe display suffix can move after the page.

## Execution and type contract

- `requires` names every incoming row field the block reads. TypeScript and construction-time checks reject unknown dependencies. Include inputs used by a lookup's `localField`/`let` as well as parent expressions. Internal temporary fields are not incoming dependencies.
- `provides` must be nonempty and name exactly the fields in `output`. Literal declarations receive TypeScript coverage checks; runtime checks also reject duplicates and mismatches. `output` infers the provided types. Other input fields remain in the inferred row; provided fields replace their old types.
- Selecting, filtering, sorting, backend scope, relation keys, custom loaders, or downstream computations can activate a producer. Dependencies propagate through other producers and ordinary derivations. Unused blocks and their unused upstream computations disappear from `.inspect()` and execution.
- A multi-output block is atomic: needing either output includes the block once per compiled pipeline. Distinct relation/dependency executions still have separate pipelines; this does not introduce cross-query caching or aggregate fusion. Its remaining declared outputs are also validated when materialized, even if unselected. An unused block does not execute or validate. Validation observes materialized values, not every intermediate value inside fused native stages.
- Producer stages retain relative registration order. The planner can add approved native prefilters and delay an independent display suffix until after safe native pagination, as described below. Context, other source fields, and undeclared native join-key identities remain available. Opaque application callbacks and unconditional native transforms conservatively keep the complete input they could observe.
- Source input policies always execute. Custom foreign reads must implement their own input policies. A conditional producer must not contain an unconditional tenant/access policy for the parents.

By registering `provides`, the backend promises that execution preserves the incoming parent rows, their order, and every field outside `provides`. Temporary fields must be cleaned up and must not clobber other inputs. This also promises that `requires` is complete. These semantic promises are not currently proved by inspecting MongoDB stages.

## Predicate placement

Approved frontend filters now run as early as the planner can safely justify. For example, `name = "Books" AND stockTotal >= 10` adds a name prefilter before the stock lookup. The complete original filter still executes afterward. No frontend syntax or backend declarations change; `.inspect()` exposes the added `$match` stages.

The planner tracks writes, including overwritten fields and temporary paths, and keeps each producer atomic. It recognizes repeatable, per-parent `$lookup`, `$set`/`$addFields`, and `$unset` blocks, managed derivations, projections, and native filters/sorts. Grouping, limiting, or windows _inside a deterministic foreign lookup_ do not depend on the parent stream and can still qualify. Unknown operators, randomness, stream-wide parent operations, and unconditional raw transforms remain boundaries. Accepted native workflows keep working when they cannot be optimized.

Boolean extraction is conservative: independent AND conditions can move early; OR needs a necessary condition from every branch; NOT requires an exact eligible subtree. A custom native condition without preparation can qualify through its declared dependencies. Deterministic custom predicate lookups can also benefit from earlier base filters. Application predicates and opaque maps/batch transforms retain their existing execution semantics.

Preserving rows alone does not justify moving a filter. A producer that adds a global total or rank still depends on the complete parent stream, so filtering ahead of it would change values. The planner leaves those operations before the filter, even when they are registered with `provides`.

Eligible positive base comparisons now also emit ordinary Mongo match conditions so existing indexes can narrow candidates. The original exact `$expr` checks remain, including the source input policy before native work. See [index-compatible predicates](index-predicates.md) for supported operations and null/array semantics. This does not fuse independent aggregate reads. The [pushdown regression cases](../packages/backend/test/predicate-pushdown.cases.ts) cover placement and Boolean/null/missing semantics.

## Display work after pagination

When the complete filter and ordering can execute in MongoDB, the planner can delay a suffix of repeatable per-parent derivations and producer blocks until after `$sort`/`$skip`/`$limit`. For a category page selecting `stockTotal` but filtering and ordering by base fields, this means only the selected categories receive the stock lookup. Filtering or sorting by `stockTotal` keeps its producer and dependencies before the page. Reader scope and default ordering also participate in this decision.

```text
Input policy → required native work → complete filter → sort/skip/limit
             → display derivations/producers → native includes → application work
```

The split preserves field versions, transitive dependencies, and atomic multi-output blocks. Delayed relation keys are ready before native includes execute. Output validation still checks the materialized values, including sibling outputs of an active producer. `.inspect()` shows the actual stage order; no new options or changes to TypeScript inference are required.

This is a conservative suffix move. Source filters/sorts, projections, raw transforms, global parent operations, randomness, and expressions inspecting the whole parent document remain boundaries. Whole-document reads inside a foreign lookup operate on foreign rows and can still qualify; capturing the whole parent through `let` does not. Temporary writes cannot overwrite planner metadata after the page.

When application filtering/sorting determines the page, the native prefix retains its existing execution strategy. Complete relation reductions and `.all()` views also keep their complete inputs. This change does not add a second MongoDB phase after application pagination or move work around arbitrary native stages. The [pagination regression cases](../packages/backend/test/native-pagination.cases.ts) exercise the result, validation, correlation, and placement guarantees, including an executionStats check that counts the parents actually enriched.

## How strongly should we enforce parent preservation?

**Current implementation:** declaration/type checks, dependency planning, recursive rejection of `$out`/`$merge`, and runtime validation of materialized output. No additional parent-stage whitelist or before/after identity comparison is installed yet. This leaves the enforcement decision separate from implementing the producer API.

The [regression cases](../packages/backend/test/native-producers.cases.ts) include a deliberately invalid producer containing a parent-level `$match`. Selecting its output reduces five parents to one, and valid output shapes do not detect the violation. A parent-level `$group`, `$unwind`, or `$sort` can similarly violate cardinality, identity, or ordering. This is a demonstrated limit, not supported producer behavior. Filters and grouping inside a `$lookup` are compatible with parent preservation.

| Approach                                                           | Guarantee and cost                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Declared contract, as implemented                                  | Maximum native flexibility and no comparison work. Backend mistakes can silently violate the declaration.                                                                                                                                                                                                                                                                        |
| Structural checks at registration                                  | Allow known parent-preserving stages such as `$lookup`, `$set`/`$addFields`, and controlled `$unset`; check write destinations against provided or temporary fields. Keep rich read-only pipelines inside lookups. Cheap, but rejects some valid advanced enrichments such as unwind/regroup workflows. It does not by itself prove that `requires` lists every read dependency. |
| Runtime identity comparison                                        | Instrument and compare parent identities, multiplicity, and ordering before/after execution. Output row counts alone are insufficient. General inline pipelines cannot be checked from final output alone; adding observations can require buffering, larger intermediate results, or additional database work. Preserved undeclared values need separate checks.                |
| Isolate producer execution and merge fields into preserved parents | Ownership can be preserved by construction, but this changes execution strategy and may add database reads or materialization. Suitable for a distinct provider strategy, not a free guarantee for arbitrary inline stages.                                                                                                                                                      |

Recommendation for the next iteration: inexpensive structural checks for ordinary inline producers, with a deliberate trusted path for advanced implementations. Keep arbitrary unconditional `.native()` transforms and `resolveBatch` available for their existing use cases. Avoid automatic before/after scans as the normal execution path. A complete MongoDB semantic analyzer would add complexity while still struggling with dynamic field access and arbitrary expressions.

This enforcement change is a proposal. The API and dependency behavior above are implemented and tested; the current contract still trusts the backend's parent-preservation and dependency declarations.
