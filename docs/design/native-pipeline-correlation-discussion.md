# Native relation pipelines: correlation, execution scope, and enforcement

Status: **Archived design discussion, before relation-first composition was implemented.** References to current behavior below describe that earlier executor. See the [implemented guide](../native-pipeline-correlation.md) for the current API.

Original status: **Design discussion, based on the earlier prototype.** This document explains the problem and recommends a direction. The proposed changes below are not implemented. Current behavior was checked against the source; the examples are small worked examples, not new integration-test results.

The important distinction is between **knowing which parent owns a result** and **running a computation on the correct collection of input rows**. A result can belong to the right parent and still contain the wrong total or an incomplete list.

For the shortest route through the problem, read scenarios 3, 4, and 8: a missing key, a preserved key with missing rows, and preserved rows with incorrect computed values. Scenario 12 connects those examples to our current planner.

## The proposed rule

Give a relation a clear meaning: match its input rows to one parent, run the backend's transformations over those inputs, and attach the output to that parent. The executor may share work across parents only when it can preserve that meaning.

This is a better default than asking every custom MongoDB pipeline to preserve a join field. Once the framework owns the parent association, the output does not need that field.

For arbitrary native fragments, default to execution inside the parent's relation. Optimize known operations through shared execution when their behavior allows it. Output schemas still validate the returned shape, and relation bindings still enforce cardinality.

This concerns backend-authored pipelines. It does not introduce frontend-defined grouping or raw MongoDB queries.

## One dataset for the examples

Use string IDs here to keep the examples readable. The same issues apply to ObjectIds.

```ts
const categories = [{ id: "books" }, { id: "games" }, { id: "empty" }];

const products = [
  { _id: "b1", categoryId: "books", name: "Book A", stock: 3 },
  { _id: "b2", categoryId: "books", name: "Book B", stock: 7 },
  { _id: "g1", categoryId: "games", name: "Chess", stock: 5 },
  { _id: "g2", categoryId: "games", name: "Cards", stock: 2 },
];
```

The relation matches `category.id` against the original `product.categoryId`.

There are two relevant execution strategies:

| Strategy                | What happens                                                                                                      | How the result finds its parent                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Shared child scan       | Fetch the matching products for several parents, run native stages, then separate the returned rows by parent.    | A usable correlation identity must survive until separation.    |
| Parent-scoped execution | Match one parent's products, run the custom stages within that relation, and retain the output under that parent. | The surrounding execution context already owns the association. |

Parent-scoped execution does not require a separate network request for each parent. A MongoDB aggregation can perform the lookups for a batch of parents.

## Scenario 1: compute a value independently for each row

```ts
const stages = [{ $set: { label: { $concat: ["Product: ", "$name"] } } }];
```

Each product receives a label. Its category, membership, and other rows do not affect the calculation.

**Shared execution:** works when the correlation field remains available. Separate the returned rows by `categoryId` afterward.

**Parent-scoped execution:** also works. The same products receive the same labels.

**Why it affects Adira:** this is a useful optimization opportunity. We can generate known row operations once over a shared scan without requiring backend authors to rewrite their code for each strategy. Native `.derive()` already covers operations of this kind when it leaves the join field alone.

**Enforcement:** the built-in operation can record which field it writes. For a raw fragment, a familiar-looking `$set` is insufficient evidence on its own: expressions can depend on the execution context or use nondeterminism. An optimizer should recognize a supported subset rather than infer safety from the stage name alone.

## Scenario 2: application mapping removes the key after association

```ts
const formatted = productSource.toApp().map((row) => ({
  label: `Product: ${row.name}`,
}));
```

The intended public resource contains only `label`. It does not need `categoryId`.

After matching Books' original rows, the framework can run the callback and attach:

```ts
const result = {
  id: "books",
  products: [{ label: "Product: Book A" }, { label: "Product: Book B" }],
};
```

**Shared execution:** can fetch raw rows together, separate them first, and then invoke application callbacks inside each parent's group. The callback's output needs no join key.

**Parent-scoped execution:** the same reasoning applies to rows returned inside a lookup.

**Current impact:** `.map()` clears `nativeOrigins`, and the relation builder requires an unchanged origin. Even `row => ({ ...row })` fails that guard. Removing the key also encounters a type restriction because `foreignField` currently refers to the transformed output type.

**Recommended fix:** retain the native input's correlation metadata independently of the application payload. The deferred executor already groups native rows before running the application stages; the builder and types should permit that arrangement.

`transformBatch()` needs the same separation, but its callback still processes a batch within a parent. This change would not turn it into an operation over every row in the relation at once.

## Scenario 3: native projection removes or rewrites the key

Removing the key:

```ts
const stages = [{ $project: { _id: 0, name: 1, stock: 1 } }];
```

Rewriting the key while keeping its TypeScript type:

```ts
const stages = [{ $set: { categoryId: "games" } }];
```

**Shared execution:** separating rows by the returned `categoryId` no longer works. In the second example, Books' rows could be assigned to Games. A schema saying `categoryId` is a string cannot detect that mistake.

**Parent-scoped execution:** both transformations can produce an associated payload. Books was matched before the transformation; changing a payload property cannot move its result into Games' relation.

**Why it affects Adira:** the shared strategy needs an identity separate from mutable output properties, or it must decline this strategy. A key's field name and TypeScript type do not establish that its value is unchanged.

**Enforcement options:** for supported row transformations, Adira could retain a private copy of the original key. For opaque fragments, execute inside the parent context instead. Merely injecting a private field before an arbitrary pipeline is insufficient: a later projection or replacement can remove it too.

If a public field named `categoryId` promises the actual owning category, deliberately returning `"games"` under Books violates that business promise. Structural association and a string schema cannot prove that additional promise; the backend should derive that field from trusted identity if it needs such a guarantee.

## Scenario 4: a native limit keeps every key but changes the result

```ts
const stages = [{ $sort: { stock: -1, _id: 1 } }, { $limit: 1 }];
```

The intended relation is the highest-stock product for each category.

| Execution                                    | Books  | Games      |
| -------------------------------------------- | ------ | ---------- |
| Run separately for each parent               | Book B | Chess      |
| Run once over both categories, then separate | Book B | No product |

Every returned key is intact in the second execution. Chess disappeared before separation, and validating Book B's key cannot recover it. `$limit` constrains the stream at its location in the pipeline. [MongoDB documentation](https://www.mongodb.com/docs/manual/reference/operator/aggregation/limit/).

**Current impact:** `preserves: ["categoryId"]` can satisfy our origin guard for such a raw fragment. It does not tell the executor that the limit must apply independently to each parent. This is a correctness risk, beyond the overly strict `.map()` rejection.

This example concerns a backend-authored `$limit` inside `.native()`. The compiler already treats frontend relation pagination separately, and the built-in relation `.first()` has its own per-parent execution. Those mechanisms do not repair arbitrary limits buried in the native prefix.

**Enforcement:** keep this fragment inside each parent's lookup, or use a built-in operation whose compiler explicitly implements per-parent limiting. Preserving the key alone must not authorize sharing.

## Scenario 5: aggregation combines different parents' rows

```ts
const stages = [{ $group: { _id: null, stock: { $sum: "$stock" } } }];
```

**Shared execution:** one result with `stock: 17`. The individual contributions have already been combined.

**Parent-scoped execution:** Books produces `stock: 10`, and Games produces `stock: 7`.

A group with a constant key combines the input rows into one group. Our different results follow from supplying different inputs to that group. [MongoDB documentation](https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/).

**Why it affects Adira:** keeping a private field on each input cannot automatically preserve it through every reduction. A combined output may represent several parents. Copying one input's key onto that output would mislabel a global total.

**Enforcement:** put the aggregation inside a parent context. The resulting `{ stock: number }` needs no correlation field. Alternatively, a specialized compiler can generate an equivalent grouped computation over explicitly tracked parent identities.

The current built-in `.sum()` already owns the operation's meaning and can generate a per-parent reduction. A raw `.native()` fragment does not currently communicate that same execution contract.

## Scenario 6: grouping by the foreign key looks shareable

```ts
const stages = [
  {
    $group: {
      _id: "$categoryId",
      categoryId: { $first: "$categoryId" },
      stock: { $sum: "$stock" },
    },
  },
];
```

For the simple scalar relation above, a shared run produces the expected Books and Games totals. This is a valid optimization when one parent corresponds to one such partition and the remaining operations are compatible.

**Why it affects Adira:** some aggregations can be optimized across parents. Defaulting opaque fragments to parent-scoped execution need not prevent a future built-in from compiling this efficiently.

**Enforcement:** recognize the complete operation and its correlation assumptions. Retaining a field with the old name does not establish equivalence for every relation, especially when a parent matches several keys.

## Scenario 7: a parent matches multiple keys, or parents overlap

Consider a second relation:

```ts
const lists = [
  { id: "A", productIds: ["b1", "b2"] },
  { id: "B", productIds: ["b2"] },
];
```

Match `list.productIds` against `product._id`. A sum over each list's products should produce A = 10 and B = 7.

Grouping a shared scan by product `_id` produces two subtotals: b1 = 3 and b2 = 7. Attaching those groups gives A two result rows, although its parent-scoped sum produces one row with 10.

Also, b2 legitimately belongs to both lists. Its database identity is not the identity of one particular parent.

**Why it affects Adira:** a shared reduction sometimes needs the private identity of each parent, rather than the child's foreign key. Matching key sets must behave like the original equality join, including avoiding duplicate contributions within a parent.

**Enforcement:** a parent-scoped lookup naturally supplies the intended input set. A shared optimizer must explicitly model parent membership and duplicate handling. Grouping by the existing foreign field is not a universal replacement.

## Scenario 8: every row and key survives, but computed values change

```ts
const stages = [
  {
    $setWindowFields: {
      sortBy: { stock: -1 },
      output: { rank: { $rank: {} } },
    },
  },
];
```

The intended field ranks products by stock within their category. Ranking depends on the rows in its window partition. [MongoDB documentation](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rank/).

| Product | Rank within its category | Rank over the shared input |
| ------- | ------------------------ | -------------------------- |
| Book B  | 1                        | 1                          |
| Book A  | 2                        | 3                          |
| Chess   | 1                        | 2                          |
| Cards   | 2                        | 4                          |

Both executions return all four products with their original keys and numeric ranks. Key checks, row counts, and the output schema all pass. The numbers still mean different things.

**Why it affects Adira:** execution scope affects values, not only ownership and missing rows. Keeping a correlation field cannot establish that a calculation is independent of the other parents' data.

**Enforcement:** keep the window operation inside each parent's relation. A specialized compiler could generate a correctly partitioned shared operation when the relation's matching rules permit it.

## Scenario 9: a transformation changes cardinality

Suppose products also have a `variants` array:

```ts
const stages = [{ $unwind: "$variants" }];
```

One matched product may produce several output rows. Those rows can all belong to the same parent without any correlation problem.

**Why it affects Adira:** valid association does not imply that a to-one relation still returns at most one result. Conversely, changing the row count does not automatically make a to-many relation invalid.

**Enforcement:** validate the resulting public shape and relation cardinality after transformation. A non-null to-one relation must have one selected result; a nullable one may have none. Extra results must not be silently discarded unless the declared operation explicitly chooses one, as `.first()` does.

For an empty category, the custom `$group` in scenario 5 produces no row. A public relation must handle that absence according to its declared cardinality. The built-in `.sum()` separately defines its empty result as zero; an arbitrary pipeline does not acquire that default automatically.

## Scenario 10: association is correct, but a policy runs too late

Suppose Books also has a product belonging to another tenant with stock 100. The tenant policy permits only the original two Books products.

The intended total is 10. Matching Books, summing all three products, and filtering the aggregate afterward cannot remove the hidden product's contribution of 100.

**Why it affects Adira:** parent association answers which category receives the total. It does not ensure the aggregate used only policy-approved inputs. Input policies and predicates over computed outputs occupy different positions in the execution plan.

**Current impact:** `compile()` starts with the source's `state.stages`, then adds the reader's `scope` condition. We must not claim that a `scope` appended there automatically restricts the inputs to an earlier arbitrary aggregation. Backend-defined `.where()` stages can already be placed explicitly before that aggregation.

**Enforcement:** represent required source-input policies before custom aggregation. Preserve result-level filtering after computation when that is its intended meaning. This ordering must be explicit rather than inferred from an output schema or a preserved key.

## Scenario 11: a pipeline introduces additional data

```ts
const stages = [{ $unionWith: "archivedProducts" }];
```

This stage can introduce rows beyond the initially matched product inputs. [MongoDB documentation](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unionwith/).

Inside Books' lookup, its output still attaches to Books. That association does not establish whether the newly introduced archived rows belong to Books or satisfy the required policies.

**Why it affects Adira:** wrapping a pipeline in a parent context guarantees ownership of the returned payload, not the meaning or permissions of every additional read the backend performs. Additional reads can also be intentional, such as loading exchange rates to compute a value.

**Enforcement:** define separately whether raw fragments are trusted backend implementations or operate within a restricted data-access contract. A restricted contract needs explicit, policy-aware additional sources or rejection of unsupported reads. Fully raw fragments remain trusted for their business logic even when their output is validated.

Parent-scoped execution also remains subject to MongoDB's stage-placement restrictions. It does not make every possible aggregation legal in a `$lookup`. Adira already rejects `$out` and `$merge` in read plans.

## Scenario 12: the planner changes strategy after an innocent refactor

The current compiler can put a relation in the root MongoDB query when pagination and relevant work are native. Otherwise it may defer the relation to the shared child scan.

For example, adding an application filter to the parent can change that decision:

```ts
const source = mongo.from(CategoryModel);
const equivalentRows = source.toApp().filter(() => true);
```

The filter retains every parent, but makes native parent pagination ineligible in the current compiler. A relation's raw native `$limit` can consequently move from a parent lookup to a shared child scan.

**Why it affects Adira:** backend authors should not get a different Games result from scenario 4 because they added a parent callback. The same concern applies to relations loaded as private computation dependencies, not just publicly selected includes.

This risk follows from the current compiler and deferred executor paths; this document does not report a new MongoDB reproduction.

**Enforcement:** establish one logical meaning for the relation. Let strategies differ only in how they execute it. When a fragment's sharing behavior is unknown, defer through batched parent-scoped lookups rather than silently moving it into a shared stream.

## What parent-scoped native execution looks like

For the category summary, the framework can generate this MongoDB stage:

```ts
const relationStage = {
  $lookup: {
    from: "products",
    localField: "id",
    foreignField: "categoryId",
    pipeline: [
      { $group: { _id: null, stock: { $sum: "$stock" } } },
      { $project: { _id: 0, stock: 1 } },
    ],
    as: "stockSummary",
  },
};
```

MongoDB applies the equality match before the inner pipeline. Its output stays in an array on the corresponding outer document. [MongoDB documentation](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/#equality-match-with-a-single-join-condition).

Books receives `[{ stock: 10 }]`, Games receives `[{ stock: 7 }]`, and Empty receives `[]`. The backend-defined resource decides how to expose those summaries and their absence.

The framework owns the outer association. The backend owns the inner computation. The computed payload needs no key-preservation assertion.

## Comparing enforcement options

| Approach                                   | What it can establish                                                             | Where it falls short                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Output schema with a required key          | The key exists and has the declared value type.                                   | Cannot establish original value, missing rows, per-parent limiting, or aggregate inputs.                           |
| Current `preserves: [...]`                 | Records the backend author's promise of unchanged fields.                         | The promise is unchecked and does not describe execution scope.                                                    |
| Private key copied before a fragment       | Supports separating outputs of controlled row operations.                         | Opaque projections can remove it; reductions can combine several parents; limits still remove other parents' rows. |
| Runtime checks against a captured key      | Detect some incorrect rewrites while both identities remain available.            | Cannot recover rows discarded earlier or separate an already combined total.                                       |
| Inspect every arbitrary MongoDB fragment   | Can reject recognized unsafe patterns or approve a supported subset.              | A general analyzer is complex and conservative, especially for nested reads and scope-sensitive stages.            |
| Framework-owned parent context             | Establishes ownership and the initial per-parent input set before transformation. | Does not prove business calculations or govern additional reads without a separate contract.                       |
| Known built-ins with specialized compilers | Can preserve the operation's specified semantics while optimizing execution.      | Only covers operations the compiler understands.                                                                   |

The recommended combination is **parent context for custom work, specialized compilation for recognized operations, and schemas for output validation**. This avoids making arbitrary MongoDB program analysis a prerequisite for flexibility.

## Type checking at each step

The proposed model retains two shapes: the original source row and the current output row. These are separate from the runtime fact that a result belongs to a particular parent.

| Step                              | TypeScript checks                                                                                                                      | Runtime or planning responsibility                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Choose the relation input         | The local key exists on the current parent row; the foreign key exists on the original child source; key element types are compatible. | Match original source rows, enforce required input policies, and handle missing/null keys according to the relation contract. |
| Build native output               | The declared runtime schema infers the next row shape.                                                                                 | Validate materialized native output; the declaration alone cannot prove raw-stage behavior.                                   |
| Apply application transformations | Callbacks receive the previous inferred payload and infer the next one.                                                                | Run callbacks in the correct parent group and respect their row/batch contract.                                               |
| Bind the public resource          | The resulting payload supplies compatible public fields and nested bindings.                                                           | Validate selected values and relation cardinality.                                                                            |
| Optimize execution                | Built-in operation types identify supported inputs and outputs.                                                                        | Choose sharing only when it preserves per-parent membership, values, ordering, and requested pagination.                      |
| Return the selected response      | Existing request types infer the client's selected result.                                                                             | Project the response without leaking private keys or intermediate values.                                                     |

No type-level proof of arbitrary MongoDB semantics is required. `PlanRow<typeof plan>` can continue to represent the current payload, while source key types survive privately through transformations. A raw output declaration remains a contract checked at materialization boundaries, not a proof that every fused intermediate value matches that declaration.

## Performance impact

Parent-scoped execution can issue one aggregation for a batch of parents, while the database performs matching and computation for each parent. It avoids a network round trip per parent but does not eliminate per-parent database work.

A shared execution can reduce repeated work, especially when parents reuse the same child rows. That optimization is valuable for compatible built-ins; it must not change the result. Indexing the foreign join field remains important for lookup performance. [MongoDB performance guidance](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/#performance-considerations).

If a parent filter or ordering depends on a custom relation result, the computation must happen early enough to decide that filter or order. Running it only for an already selected page would not preserve the query's meaning.

Candidate and output budgets still apply. A server-side aggregate may process many source documents while returning one small value, so an application materialization budget does not by itself bound the database's scan work.

No performance benchmark is asserted here. The proposal changes which strategies are valid; workload measurements would determine which valid strategy is faster.

## Where the current implementation needs to change

| Location                                                               | Current responsibility                                                                                                                              | Proposed change                                                                                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [Plan types and relation builder](../../packages/backend/read/plan.ts) | `JoinOptions` uses the child's current output type; `.one()`/`.many()` require unchanged `nativeOrigins`. Application mapping clears that tracking. | Separate original source keys, native-prefix correlation, and current payload assumptions. Replace blanket rejection with strategy eligibility. |
| [Relation compilation](../../packages/backend/read/execute.ts)         | `compile()` chooses root lookups using native pagination and field availability.                                                                    | Also account for the native fragment's execution semantics, conservatively retaining parent context for unknown fragments.                      |
| [Deferred relation execution](../../packages/backend/read/execute.ts)  | `materializeRelation()` performs a shared native scan, then groups by the returned foreign key before application processing.                       | Keep this path for compatible plans; add batched parent-scoped execution for plans that cannot use it.                                          |
| [Native relation dependencies](../../packages/backend/read/execute.ts) | `materializeDependency()` already retains a parent index outside each lookup's result.                                                              | Reuse the association pattern for deferred custom relations, retaining existing validation, policies, and budgets.                              |
| [Architecture stress test](../architecture-stress-test.md)             | Records the mapped-child restriction.                                                                                                               | Treat the restriction and the broader raw-pipeline execution-scope risk as related but distinct issues.                                         |

The frontend query language and existing response annotations do not need a new correlation concept. This is a backend plan/type/execution change.

## Proposed decisions to refine

1. Define child transformations as operating within the matched parent's relation. Reusing a plan at a root operates on that root's inputs; make that context distinction explicit.
2. Keep parent ownership outside the transformed payload whenever execution is already parent-scoped.
3. Preserve original source key types through both native and application transformations.
4. Use shared execution only when the compiler can establish equivalence. An unchanged key alone is insufficient evidence.
5. Default opaque native fragments to parent-scoped execution, subject to supported MongoDB stages and explicit source/policy rules.
6. Keep `preserves` distinct from any future sharing contract. Decide whether it remains a trusted optimization declaration or is superseded by controlled operations.
7. Add conformance cases for both execution strategies: key removal/rewriting, per-parent limits and totals, overlapping key sets, cardinality, policies, and application-dependent parent filtering.

These are proposed backend contracts, not newly available APIs. The next implementation should make scenario 2 work and ensure scenarios 4, 8, and 12 cannot silently change answers when the planner selects a different strategy.
