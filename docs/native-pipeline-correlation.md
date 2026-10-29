# Relation-first native and application workflows

Status: **Implemented and covered by type checks and MongoDB integration tests.** The earlier scenario-by-scenario discussion is preserved in the [design notes](design/native-pipeline-correlation-discussion.md).

The rule is simple: **establish the relation, then transform its matched rows.** A custom pipeline receives one parent's related inputs. Its output can remove or rewrite join fields without changing which parent owns the result.

## Native aggregation without retaining a key

Assume typed `Category` and `Product` Mongoose models, with `Category._id` matching `Product.category`:

```ts
import { defineResource, field, schema } from "@n/adira.core.ts";
import { defineRead, mongo, type PlanRow } from "@n/adira.backend.ts";

const categories = mongo.from(Category);
const products = mongo.from(Product, {
  scope: (e) => e.eq(e.field("isActive"), true),
});
const Stock = defineResource({ stock: field.number() });

const summaryPlan = categories
  .related(products, { localField: "_id", foreignField: "category" })
  .native({
    stages: [{ $group: { _id: null, stock: { $sum: "$stock" } } }],
    output: schema.object({ stock: schema.number() }),
  });

type SummaryRow = PlanRow<typeof summaryPlan>; // { readonly stock: number }
const summary = summaryPlan.one(Stock);

const readCategories = defineRead(
  defineResource({
    name: field.string(),
    stockSummary: field.one(Stock).nullable(),
  }),
  { source: categories, relations: { stockSummary: summary } },
);
```

Each category gets its own total over its active products. An empty group has no row, so this example exposes a nullable summary. No `preserves` declaration is needed. The same relation binding supports `.get({ select: { stock: true } })` as an input to an application `.load()` stage.

## Application transformations use the same context

```ts
const ProductLabel = defineResource({ label: field.string() });

const labelPlan = categories
  .related(products, { localField: "_id", foreignField: "category" })
  .project(["name"])
  .toApp({ batchSize: 128, concurrency: 8 })
  .map(({ name }) => ({ label: name.toUpperCase() }));

type LabelRow = PlanRow<typeof labelPlan>; // { label: string }
const labels = labelPlan.many(ProductLabel);
```

Native relation plans expose `derive`, `where`, `sortBy`, `project`, `native`, `use`, and `toApp`. Application relation plans expose `load`, `derive`, `map`, `filter`, `transformBatch`, and `use`. Both support condition factories and declaring nested relations with `.related()`.

Finish with `.one(Resource, options?)` or `.many(Resource, options?)` to check the public shape, nested relation bindings, and predicate implementations. The resulting binding retains the existing `all`, `count`, `exists`, `sum`, `avg`, `min`, `max`, `first`, `last`, and `get` operations, according to its cardinality.

`transformBatch` processes one batch within one parent's relation. Use complete relation dependencies and their reductions for computations that need the entire relation. There is still one native phase followed by one application phase.

## Input policies precede transformations

`mongo.from(Model, { scope })` defines a native policy over original source rows. The callback receives typed expressions and the request context:

```ts
const visibleProducts = mongo.from(Product, {
  scope: (e, context) =>
    e.and(
      e.eq(e.field("isActive"), true),
      e.gte(e.field("stock"), (context as { minimum: number }).minimum),
    ),
});
```

The policy runs before source/native transformations at roots, in display relations, and in private computation dependencies. It still applies when a later projection or aggregation removes its input fields.

The existing `defineRead(..., { scope })` and relation binding `scope` remain result-level conditions over the transformed row. Use the source option for required policies over aggregation inputs. A custom pipeline that reads additional collections remains responsible for those additional reads.

## Type checks and execution

| Step                          | Guarantee                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `.related(source, join)`      | Check that join fields exist on the supplied inputs and have compatible element types.     |
| `.native({ stages, output })` | Infer the next payload from its runtime schema; validate materialized native output.       |
| Application callbacks         | Infer each intermediate payload, including asynchronous results and batch outputs.         |
| `.one()` / `.many()`          | Check the final public resource shape and required bindings; validate runtime cardinality. |
| Client selection              | Retain exact selected response inference and the existing Express response annotation.     |

Association is established before payload transformations, so the output type does not need to retain the foreign key. `PlanRow<typeof plan>` exposes the current payload. A relation-scoped plan is bound to a resource rather than used as an unscoped root.

The compiler uses an in-query lookup when possible and batched parent lookups otherwise. Both keep parent identity outside the child payload. A deferred relation no longer runs custom native stages over a merged stream of several parents' rows.

`.inspect(query).relationStrategies` reports `"lookup"` or `"batched-lookup"` for each selected relation. Native aggregate dependencies still report their MongoDB/application strategy separately.

Batched lookups avoid a request per parent, but computation may repeat across parents. Candidate budgets apply within each materialized parent context. Private keys are excluded from the response. Empty/null join keys yield no relation, including when a custom fragment can emit a default on an empty input.

## What happened to the twelve scenarios?

| Earlier scenario                          | Current behavior                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1. Per-row computation                    | Supported normally.                                                                                   |
| 2. Application map drops keys             | Supported after `.related()`, including identity and batch transformations.                           |
| 3. Native output removes or rewrites keys | Supported after `.related()`; output fields do not control ownership.                                 |
| 4. Native limit                           | Applies within each parent's relation in direct and deferred execution.                               |
| 5. Native grouping                        | Aggregates each parent's matched inputs.                                                              |
| 6. Grouping by a foreign key              | No special sharing declaration is required.                                                           |
| 7. Multiple/overlapping keys              | Match the complete set for each parent and avoid duplicate contributions from repeated keys.          |
| 8. Window ranks                           | Evaluate within the same declared parent context.                                                     |
| 9. Cardinality                            | Remains explicit runtime validation.                                                                  |
| 10. Policy placement                      | Source policies run before transformations.                                                           |
| 11. Additional data reads                 | Remain trusted backend logic, subject to normal MongoDB restrictions and the policies of those reads. |
| 12. Strategy changes                      | Direct and deferred lookups preserve the same per-parent meaning.                                     |

The legacy `source.one(Resource, { plan, ...join })` and `.many(...)` forms remain available for existing bindings. They require the join field to be retained by the supplied source. For output-shape transformations, declare `.related()` first and bind the public resource last.

The working controller is [composable-categories.ts](../examples/backend/src/controller/composable-categories.ts). Intermediate-type checks are in [relation-context.types.ts](../packages/backend/test/relation-context.types.ts), and execution/conformance cases are in [relation-context.cases.ts](../packages/backend/test/relation-context.cases.ts). Run `npm run demo:read` from the repository root to see a deferred native summary alongside the earlier examples.
