# Computed fields depending on relations

Status: `.load()` and relation `.all()`, `.count()`, `.exists()`, `.sum()`, `.avg()`, `.min()`, `.max()`, `.first()`, `.last()`, and to-one `.get()` are implemented. Eligible count/sum/avg/min/max relations use bulk MongoDB grouping across parents. Existence and first/last/get limits retain per-parent MongoDB execution; application implementations use complete, bounded evaluation.

The compiler examples in [relation-dependencies.types.ts](../packages/backend/test/relation-dependencies.types.ts) and [relation-operations.types.ts](../packages/backend/test/relation-operations.types.ts) use the actual APIs. There are no declaration-only helper APIs. They check intermediate shapes, selected child fields, async return inference, aggregate types/nullability, and intentionally invalid usage marked with `@ts-expect-error`.

Run the compiler checks from the repository root:

```sh
npm run test:types -w packages/backend
```

These compiler checks do not access a database or measure compiler performance. The integration suite also checks native/application parity, validation, array joins, and budget failure. Run it with `npm run test:read`; it requires a local `mongod`. `npm run demo:read` shows both `.all()` with a JavaScript reduction and optimized dependencies. The example `/api/categories/composable` endpoint exposes `stockTotal`, `productCount`, `hasProducts`, `stockAverage`, and `topProductName` using these APIs.

## Declare a relation view as a typed dependency

A relation definition supplies correlation, the child resource and source, and backend scope. A dependency specifies which view of that relation a computation needs. A display selection is another view, potentially with different filtering and pagination.

For shape-changing native or application work, declare `.related(source, join)` first, transform its matched rows, then finish with `.one(Resource)` or `.many(Resource)`. That binding supports the same dependency operations below. The [relation-first guide](native-pipeline-correlation.md) shows native grouping and mapping without retaining a join key in the payload.

The source derivation API consumes a private loaded dependency directly from the relation binding:

```ts
const invoices = accountSource.many(InvoiceResource, {
  plan: invoiceSource,
  localField: "_id",
  foreignField: "accountId",
});

const withBalances = accountSource.toApp().load(
  "balanceInputs",
  invoices.all({
    select: { balance: true },
    where: { status: { $eq: "open" } },
  }),
);

// PlanRow<typeof withBalances> includes:
// balanceInputs: readonly { balance: number }[]

const source = withBalances.derive(
  "outstandingBalance",
  ["balanceInputs"],
  ({ balanceInputs }) =>
    balanceInputs.reduce((sum, invoice) => sum + invoice.balance, 0),
);

const getAccounts = defineRead(AccountResource, {
  source,
  relations: { invoices },
});
```

Assume `AccountResource` declares a numeric `outstandingBalance` and an `invoices` relation to `InvoiceResource`, and that `invoiceSource` produces numeric `balance` values, potentially using application derivations.

Both `.load()` and `.all()` are lazy declarations. `.load()` adds an inferred intermediate field and a dependency edge; it does not execute a query during construction. Its output is an input to the existing `.derive()` callback. `balanceInputs` remains private because it is absent from the public resource.

The type checks should establish:

- Only valid child selections and filter operands are accepted.
- `balanceInputs` contains exactly the selected child fields, with their declared types and cardinality.
- The derivation receives only its declared dependencies.
- The derivation's awaited output type becomes the intermediate field type.
- Binding through `defineRead` verifies that output against the public scalar descriptor.

## Completeness is part of the dependency contract

`.all()` means all matching rows of the backend-defined relation, subject to its policies and explicit execution budgets. It accepts `select`, `where`, and `orderBy`, with no display page at any selected relation level. Selected nested collections are complete too. Public-query default and maximum page sizes do not truncate this internal dependency. A to-one relation cannot call `.all()`; nested to-one selections still preserve their declared nullability and enforce cardinality.

For example, the frontend can select the three newest invoices while also selecting `outstandingBalance`. That balance must still use the complete backend-specified set of open invoices. Changing the selected invoice page or its frontend filter must not change the balance.

Materialized `.all()` inputs and complete application fallbacks throw `ReadBudgetError` when they exceed `maxCandidates` within a parent context. Batched lookups keep each parent's native work separate, and application evaluation retains that same per-parent budget. Native reductions avoid materializing their full input: their database scan can exceed that application candidate budget while returning a small result. Neither path returns a total over a silently truncated set. A calculation intentionally using a displayed page would need an explicitly different contract, such as a subtotal attached to that page.

The relation definition is reused, including child policies, request context, validation, and computed-field dependencies. Multiple derived fields can consume one loaded intermediate field. Separate `.load()` stages and display selections currently execute independently; cross-view fetch sharing is a future optimization. Loading rejects a binding from a different source scope, even if its row type happens to match.

## Schedule dependencies according to their consumers

For a computed field used only in output:

```text
root policies and filters → root ordering/page
  → batch-load the required relation view for those parents
  → compute the field → project the requested response
```

For a computed field used in a root predicate or ordering:

```text
root policies and safe candidate reduction
  → batch-load the required relation view
  → compute the field → evaluate the complete root filter
  → order/page → project the requested response
```

The second path cannot paginate parents before it knows their computed membership/order. Existing conservative Boolean pushdown rules still apply. Application-defined ordering may require evaluating all candidates within the configured budget.

Only requested or transitively required application stages execute. In particular, the loader does not run just because the source declares it. Opaque `map`/`filter`/`transformBatch` callbacks can observe all preceding fields, so those stages require all earlier derivations and loads. The native prefix remains static, as elsewhere in this prototype.

The planner moves a safe application suffix after pagination, retaining source-stage order to preserve overwritten intermediate values. Earlier display computations may therefore remain before pagination if a later stage affects membership or ordering. Related rows are correlated privately with their parent and loaded in batches rather than through a query per parent. Child plans can themselves load relation dependencies. Cyclic definitions/dependencies produce planning errors; recursive resource definitions remain unsupported.

## Aggregate and single-row dependencies

Arbitrary JavaScript reductions stay application work. Explicit aggregate dependencies describe the operation so the planner can select native execution:

```ts
const source = accountSource.toApp().load(
  "outstandingBalance",
  invoices.sum({
    field: "balance",
    where: { status: { $eq: "open" } },
  }),
);
// The dependency value is number; the public response contract is unchanged.
```

All operations are lazy and use `.load(name, dependency)`:

| Operation              | Arguments                     | Value                  | Empty result |
| ---------------------- | ----------------------------- | ---------------------- | ------------ |
| `.count()`             | Optional `{ where }`          | `number`               | `0`          |
| `.exists()`            | Optional `{ where }`          | `boolean`              | `false`      |
| `.sum()`               | `{ field, where? }`           | `number`               | `0`          |
| `.avg()`               | `{ field, where? }`           | `number \| null`       | `null`       |
| `.min()` / `.max()`    | `{ field, where? }`           | `number \| null`       | `null`       |
| `.first()` / `.last()` | `{ select, orderBy, where? }` | Selected row or `null` | `null`       |
| `.get()` (to-one only) | `{ select, where? }`          | Selected row or `null` | `null`       |

Numeric operations accept numeric scalar fields, including nullable numbers. They ignore declared null/missing values. Count includes matching rows with null numeric fields; average divides by the number of non-null values. Invalid non-null/non-finite numeric inputs fail validation rather than being silently ignored by MongoDB. Numeric outputs must remain finite. Small floating-point differences between server and JavaScript arithmetic are possible.

First/last require explicit, non-empty ordering by approved sortable fields. An unchanged source `_id`, when available, is appended as a tie-breaker; last reverses the complete ordering. If no source identity remains, supply a unique ordering for deterministic ties. Selected nested collections remain complete, without display pages. `.get()` returns a selected row or `null`, and rejects multiple matches. A required public to-one relation retains its separate required-relation contract when selected publicly.

## Native eligibility and inspection

Count/exists require native membership tests; numeric reductions also require a native aggregate value. Unused application derivations do not prevent optimization. Native first/last require native membership and ordering, while selected output may still use application derivations or nested relations after the limit. Necessary application work causes a complete application fallback.

Built-in scalar schema metadata lets reductions validate inputs in MongoDB. Unknown/custom source or predicate-output parsers force application evaluation. Custom aggregate-field parsers also force application evaluation, preserving their transformations. Third-party parsers opting into `ValueSchema.native` metadata promise equivalent, non-transforming native validation.

Eligible count/sum/avg/min/max dependencies query matching children for a batch of distinct ObjectId parent keys and group once. Original correlation is retained privately through managed projections and field overwrites; foreign array membership is deduplicated. The compiler reuses exact policies, filters and native validation. Missing groups and missing/null parent keys produce zero for count/sum and null for average/minimum/maximum. For nullable numeric fields, all-null inputs sum to zero and have null average/minimum/maximum. Existence retains its short-circuit per-parent strategy.

Opaque native blocks, grouping, limits, windows and custom predicate preparation retain parent-scoped execution. Runtime batches containing array-valued or non-ObjectId parent keys also keep the original strategy. Literal parent keys feed server-side `$lookup` operations, each applying the complete child pipeline independently; its seed supports empty collections without returning fabricated source data. Both native strategies retain complete inputs. Queries remain bounded by the child batch size and separate from the root pipeline.

Consecutive compatible native count/sum/avg/min/max loads now share one aggregation per parent batch. They must use the same relation binding, membership and captured policy, with no intervening work or dependency on a previous load's output. Fusion preserves individual demand pruning, validators, empty defaults and placement before or after pagination. `.inspect().reductionGroups` exposes the shared bodies and phases; each dependency reports `fusedWith` or a `fusionReason`. Other loads keep their sequential execution. See [bulk eligibility, fusion and scheduling](bulk-reductions-and-load-scheduling.md).

```ts
const source = categorySource
  .load("productCount", products.count())
  .load("stockTotal", products.sum({ field: "stock" }))
  .load("stockAverage", products.avg({ field: "stock" }))
  .load(
    "topProduct",
    products.first({
      select: { name: true },
      orderBy: { stock: "desc" },
    }),
  );

// After binding the source with defineRead:
const plan = read.inspect({ select: { stockTotal: true } });
// plan.dependencies.stockTotal:
// { operation: "sum", strategy: "mongodb", execution: "bulk", pipeline, child }
```

Inspection retains `strategy: "mongodb" | "application"`. Native dependencies add `execution: "bulk" | "parent-scoped"`, with a reason when opaque child work prevents bulk execution. A bulk plan retains the runtime parent-key guard described above. Root filtering/ordering by loaded values happens after dependencies resolve; a native child aggregate does not make an application-derived parent column native. These are backend-defined computations.

Supporting unrelated source providers or arbitrary correlation remains a separate extension. The current implementation reuses the existing keyed MongoDB relation bindings and child native/application derivations, and preserves the Express/generated-client resource bridge.
