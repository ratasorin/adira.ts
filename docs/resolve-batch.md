# Custom relation loaders with resolveBatch

Use `.related({ requires, output, resolveBatch })` when the backend should own fetching an entire batch. It produces an application relation plan, with the same `.one(Resource)` / `.many(Resource)` bindings and dependency operations as MongoDB relations.

```ts
const Summary = defineResource({ stock: field.number() });

const summaries = categorySource.related({
  requires: ["_id"],
  batchSize: 128,
  output: schema.object({ stock: schema.number() }),
  resolveBatch: async ({ parents, context }) => {
    // row is inferred as Readonly<Pick<CategoryRow, "_id">>.
    const totals = await Product.aggregate([
      { $match: { category: { $in: parents.map(({ row }) => row._id) } } },
      { $group: { _id: "$category", stock: { $sum: "$stock" } } },
    ]);
    const byCategory = new Map(
      totals.map((total) => [String(total._id), total.stock]),
    );
    return parents.map(({ ref, row }) => ({
      ref,
      rows: [{ stock: byCategory.get(String(row._id)) ?? 0 }],
    }));
  },
});

type SummaryRow = PlanRow<typeof summaries>; // { readonly stock: number }
const summary = summaries.one(Summary);
```

The callback can use raw MongoDB, SQL, an HTTP service, caches, or ordinary TypeScript. It can deduplicate shared keys and combine aggregates in one query. Adira never scans the relation's inherited MongoDB adapter for this provider. The root source remains MongoDB-backed; this does not add custom root sources.

## The contract

- `requires` determines the parent fields visible to the callback and retained by the planner, including fields not selected by the frontend. An empty array is allowed.
- `output` determines the inferred candidate type and validates every returned candidate before application transformations, filtering, or pagination. Parsing strips undeclared fields. Final selected values are also validated against the public resource.
- Return exactly one `{ ref, rows }` entry for every supplied parent. Use `rows: []` for no matches. Result entries may arrive in any order.
- `ref` is opaque and valid only within that invocation. Return the original object unchanged. Missing, duplicate, fabricated, and previous-invocation references fail explicitly.
- Return **complete candidates**, without frontend pagination. Adira applies the binding's scope, approved Boolean filters, ordering, pagination, nested relations, and response projection afterward. To-one nullability/cardinality rules remain enforced.
- `maxCandidates` limits returned candidates per parent before filtering/pagination. Exceeding it fails the read; Adira does not silently truncate.

`batchSize` bounds parents per invocation and defaults to the parent plan's batch size. Actual batches can be smaller because parent processing already runs in chunks. Invocations are processed sequentially; the callback controls concurrency within its work. Sharing is per invocation, with no automatic request cache or reuse between distinct dependencies. Empty parent sets and unused relations do not invoke the loader.

Parent entries and their field containers are shallowly frozen. `context` is the request context passed to the executor. Declare it once with [`createReadContext<Context>()`](read-context.md) to infer it throughout loaders, transformations, scopes, and predicates. Existing context-independent sources retain `unknown` context.

## Composition

The returned plan supports `.map`, `.filter`, `.derive`, `.transformBatch`, `.load`, `.use`, and nested `.related`. Native stages are unavailable: any custom MongoDB work goes inside `resolveBatch`. Batch transforms still operate per child's processing chunk, rather than across every parent together.

```ts
const stocks = summaries.one(Summary);
const enriched = categorySource
  .load("summary", stocks.get({ select: { stock: true } }))
  .derive("stockTotal", ["summary"], ({ summary }) => summary?.stock ?? 0);
```

To-many bindings also support `.all`, `.count`, `.exists`, `.sum`, `.avg`, `.min`, `.max`, `.first`, and `.last`. These run over complete application candidates for custom providers. Values needed for parent filtering/ordering load before parent pagination; display-only dependencies can load afterward. `.inspect()` reports the relation strategy as `resolveBatch` and application fallback for dependencies.

## Boundaries

This is a candidate loader, not a complete query executor: it does not receive frontend query instructions for database pushdown. Large relations needing database-side frontend filtering/pagination should use a native relation plan for now. Backend-defined aggregation inside the callback can still return a small summary efficiently.

Custom reads explicitly implement their own input/tenant/access policies. A binding's result scope cannot retroactively remove excluded inputs from an aggregate. Types and runtime validation check shape and parent accounting; they cannot prove completeness or the correctness of business calculations.

See the [typed example](../examples/backend/src/controller/batch-category-summary.ts), [inference checks](../packages/backend/test/resolve-batch.types.ts), and [integration cases](../packages/backend/test/resolve-batch.cases.ts). `npm run demo:read` includes a custom batch aggregation combining count and sum.
