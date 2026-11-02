# Architecture discussion: resource contracts and composable execution

Status: **Draft, with an executable prototype**. The [implementation guide](docs/composable-reads.md) documents the API that now works and its current boundaries. The broader directions below remain proposals where the prototype does not implement them; older sketches are illustrative.

The [expanded dashboard experiment](examples/stress/reports/advanced-expressivity-analysis.md) validates the current contract with complex Boolean predicates, relation-dependent computed fields and independent nested pages. It retains frontend grouping restrictions and candidate budgets. A second typed `resolveBatch` implementation preserves the same order contract while sharing root stock work. Compatible native reduction fusion is now implemented and measured in a [paired benchmark](examples/stress/reports/reduction-fusion-paired/report.md). Cross-parent include batching, scoped request reuse and query-aware custom-provider inputs remain proposals.

The [architecture stress test](docs/architecture-stress-test.md) records backend scenarios, remaining binding/recursion failures, and proposed changes to source and processing contracts. Configurable batching alone does not address restrictions on custom sources or recursive resources.

The [native relation pipeline guide](docs/native-pipeline-correlation.md) documents implemented relation-first composition: declare `.related(source, join)`, transform its matched rows, then bind `.one(Resource)` or `.many(Resource)`. Direct and deferred reads both use parent-scoped lookups. The earlier detailed scenarios remain in the [archived design discussion](docs/design/native-pipeline-correlation-discussion.md).

The [relation-dependent field guide](docs/relation-dependent-fields.md) documents implemented, lazy relation dependencies and application `.load()` stages. Complete inputs and aggregates remain independent of frontend-selected relation pages, with scheduling before or after root pagination according to their consumers. Count/exists, sum/avg/min/max, first/last, and to-one get use native MongoDB reductions/limits when eligible, with complete application fallbacks.

## Prototype decisions implemented

- Add an opt-in `defineRead` API alongside existing handlers. The new language uses a required nested `select`, approved `where`, `orderBy`, and `page`; it rejects frontend grouping and raw aggregation. Legacy operations remain available for compatibility.
- Use `defineResource` descriptors for both public type inference and runtime validation, including explicit predicate capabilities and `.orderable()` fields.
- Use `mongo.from(...).derive(...).project(...).toApp().derive(...)`, reusable `.use(...)` fragments, and `PlanRow<typeof plan>` for intermediate inference. Raw native output types come from a runtime schema. There is one native prefix and one application suffix.
- Prune unused native `.derive()` stages through backward field dependencies, including transitive inputs, overwritten versions, filters, ordering, relation keys, application work, and relation aggregates. Validate retained derived output rather than forcing unused computations to run for validation. Preserve source policies, field versions, raw native blocks/contracts, and complete inputs visible to opaque callbacks; explicit native projections bound those inputs.
- Move approved native predicates ahead of independent repeatable parent-local work, and move an eligible display-only native suffix after a proven safe native page. Keep global/opaque work and application-defined pages conservative. See [producer scheduling](docs/native-field-producers.md).
- Compile supported positive field predicates into necessary index-compatible Mongo matches while retaining exact expression checks. Source input policy stays first, with its own exact residual. Use explicit built-in metadata, never infer index facts from arbitrary raw expressions. AND can retain known necessary branches; OR requires all branches; approximate matches are never negated. Null filters include legacy BSON undefined, and scalar equality keeps its stricter array semantics. No frontend/backend API or inference change is required. See [index-compatible predicates](docs/index-predicates.md).
- Extend `.native()` with `{ provides, requires, stages, output }` for atomic, demand-driven field producers at roots and in relations. Infer added/replaced field types without dropping other input fields, retain context and undeclared join identities, prune unused blocks, and activate them through the same dependency mechanism for selection/filter/order/composition. The backend currently promises parent/undeclared-field preservation and complete read dependencies; declarations, read-only stages, and materialized output are checked, but semantic preservation is not proved. [Enforcement options and recommendation](docs/native-field-producers.md#how-strongly-should-we-enforce-parent-preservation) remain a separate design decision. Unconditional `.native({ stages, output })` keeps its existing transform semantics.
- Declare backend context once through `createReadContext<Context>()`. Propagate it through plans, scopes, predicates, relation bindings/dependencies, loaders, and application callbacks; require it for execution and inspection. Allow context-independent/smaller-requirement sources through an execution-input interface, while checking compatibility and retaining intermediate row inference. Keep legacy optional unknown context. Strip backend context from generated public executor declarations and avoid collecting context-only dependencies. See [typed context](docs/read-context.md).
- Bind resources with `defineRead(Resource, { source, relations, filters, scope, limits })`. Relation factories use `.one`/`.many`; filter factories return `.condition`, `.appCondition`, or `.pipelineCondition`. Preparation stages preserve parents until the enclosing Boolean expression decides membership.
- Check scalar output compatibility directly on resource arguments through `CompatibleResource`, rather than encoding shape errors as required options. Preserve safe widening, required field presence, nullability, and enum coverage; keep relation/predicate options independently required where appropriate. Native TypeScript diagnostics identify the field, incompatible types, missing plan fields, or expected/received wider output. Compiler-API regression cases verify real diagnostics and argument locations alongside the existing inference tests; no compiler plugin or custom checking command is required.
- Prefer `.related(source, join)` before shape-changing work. Its native/application builders retain association outside the payload and check resource shape at the final `.one`/`.many` binding. Join keys can disappear from intermediate/output types. Legacy direct bindings remain available for sources retaining their original join field.
- Support `.related({ requires, output, resolveBatch })` for backend-owned batch fetching. Infer parent dependencies/output from declarations, retain association through invocation-local opaque references, validate complete candidates/accounting, and reuse `.one`/`.many`, application transforms, dependencies, and managed query semantics. This is a candidate loader, not a query-pushdown executor; custom input policies and completeness remain the backend's responsibility. See [the loader guide](docs/resolve-batch.md).
- Apply `mongo.from(Model, { scope })` policies over original inputs before native transformations, including aggregate inputs. Reader/binding `scope` remains a condition over transformed output.
- Execute compatible relation prefixes inside `$lookup`, with application suffixes outside MongoDB; defer display relations until after application membership tests. Apply child pages per parent, including array correlation keys.
- Execute deferred relations through batched parent lookups, preserving the same input context for raw limits, grouping, window functions, and application callbacks. `.inspect()` exposes `relationStrategies`; candidate budgets apply per materialized parent context. Arbitrary custom native work is not moved into a merged child stream.
- Expose complete relation views directly as `relation.all({ select, where, orderBy })`, consumed by `.load(name, dependency)`. Reject display pagination throughout a complete selection; reuse child policies, validation, and budgets. Prune unused loads and resolve required inputs before predicates/order or in a safe suffix after pagination.
- Optimize declared relation count/exists, numeric reductions, first/last, and to-one get through batched server-side lookups. Preserve native validation semantics and selected application output; show native/fallback strategy and dependency pipelines in `.inspect()`. Keep arbitrary JavaScript reductions as application work.
- Execute eligible count/sum/avg/min/max dependencies through bulk child grouping, retaining original private correlation, nullable results and existing validation. Guard scalar ObjectId parent keys at runtime, deduplicate shared parents/foreign array membership, and retain parent-scoped execution for other key shapes and opaque native work. Existence retains its per-parent short circuit. Keep each load independently prunable. Inspection retains its strategy contract and adds native `execution` details.
- Keep the existing explicit Express response annotation. Managed results have an opaque type-only marker; generated clients specialize their result to the actual selection. New queries travel in a single JSON query parameter.
- Validate request capabilities, provider coverage, raw outputs, and selected response values. Use bounded candidates for mixed filters/order and fail rather than silently return incomplete pages.

General relation quantifiers, custom root sources, query-aware custom executors, new database adapters, cursor pagination, and whole-subtree custom compilers remain open. The prototype's type and integration checks live in [packages/backend/test](packages/backend/test).

The [execution-strategy guide](docs/bulk-reductions-and-load-scheduling.md) covers implemented bulk count/numeric grouping and proposed bounded parallel execution of safe adjacent loads. The [original bulk benchmark](examples/stress/reports/bulk-reductions-comparison.md) measures count/sum grouping with unchanged application declarations. The [numeric and demo comparison](examples/stress/reports/numeric-and-demo-query-comparison.md) separately measures avg/min/max and application-owned bulk revenue/cost/stock queries through typed `resolveBatch`. It preserves the full resources and existing independent load pruning; the framework does not rewrite the raw query bodies.

The earlier [ROI analysis](examples/stress/reports/query-roi-analysis.md) motivated bulk native reductions and the demo query rewrites. Eligible managed numeric defaults now choose bulk grouping, and the demo explicitly batches its formerly correlated revenue/cost/stock queries. Consecutive compatible native count/sum/avg/min/max loads share one validated scan per parent batch, preserving pruning, captured policies and pagination phases; inspection exposes groups and compatibility barriers. Safe adjacent load overlap and nested include strategies remain separate work.

## Goal

Let the frontend request different shapes of backend-defined resources through existing REST routes, while the backend controls data access, implementation, and execution strategy. MongoDB remains the initial optimized provider; the common contract should allow other providers later.

The frontend can compose approved capabilities. The backend defines which resources, fields, relations, predicates, and operations exist.

## Proposed directions

### 1. Separate the resource contract, query intent, and execution

```text
REST request
  → parse and validate against the resource contract
  → apply backend policies and build a logical query plan
  → compile through built-in or custom providers
  → execute
  → project, serialize, and validate the response
```

The logical plan describes requirements independently of a particular database pipeline. It includes requested output, filter predicates, relation requirements, pagination, and internal dependencies.

Built-in MongoDB primitives and custom implementations use the same execution contract. Support replacing individual fields, predicates, or relations, as well as a complete executor. Keep Express integration thin.

### 2. Use executable resource metadata as the public contract

A resource describes public field types, relation cardinality/nullability, serialization, and supported operations. Derive frontend types and runtime validators from this metadata so they describe the same API.

```ts
const Orders = defineResource({
  id: field.string(),
  status: field.enum(["pending", "paid", "cancelled"]).filterable("$eq", "$in"),
  total: field.number().filterable("$gte", "$lt"),
  customer: field.one(Customers).nullable(),
});
```

Selection, filtering, and sorting are separate capabilities. A selectable field need not be filterable. Public resource fields need not correspond directly to storage fields.

The contract-authoring approach is still open: reuse Mongoose metadata where possible, use explicit public descriptors, or combine them. Avoid independently maintained runtime schemas and TypeScript interfaces that can drift.

### 3. Consider one selection tree for scalar fields and relations

```ts
select: {
  id: true,
  total: true,
  customer: { select: { name: true } },
}
```

A nested selection expresses both relation loading and projection, avoiding inconsistencies between separate `include` and `select` instructions. This is a proposed API simplification; compatibility with the existing syntax needs a decision.

Relations should have a stable public meaning: for example, `customer` is an object or `null`, and `customerId` is a separate field if needed. Selecting a relation should not change the same field from an identifier into an object.

Returned fields and execution dependencies are distinct. Filtering by a field does not select it. Identifiers and intermediate values needed internally must not leak into the response.

### 4. Remove frontend-defined grouping from the proposed public API

The frontend should not supply arbitrary `groupBy` definitions or aggregate expressions. Expose dashboard summaries as backend-defined resources, endpoints, or named computed fields with explicit inputs and outputs.

For example, `GET /orders/summary` can expose a backend-defined summary without accepting arbitrary grouping instructions.

The treatment of existing generic operations such as `pickDistinct` remains open; they should be evaluated against the same principle.

### 5. Allow recursive Boolean composition over approved predicates

```ts
where: {
  $or: [
    { status: { $eq: "paid" } },
    {
      $and: [
        { total: { $gte: 100 } },
        { $not: { status: { $eq: "cancelled" } } },
      ],
    },
  ],
}
```

The backend defines permitted fields and their operators. Adira derives operand types, including enum values. Boolean operators can nest at recognized predicate scopes. Multiple properties in a predicate object mean conjunction.

This is an Adira predicate language with explicit semantics, even if operator names resemble MongoDB. Adapters translate it; raw request objects are not database queries.

Recursive syntax must have runtime bounds, including expression depth, node count, operand size, and result limits. Preserve the expression tree rather than expanding it into all possible combinations.

### 6. Compose symbolic predicates, with precisely typed leaf handlers

A custom filter handler receives the operand type for its specific field and operator and returns a predicate for a compatible source scope.

```ts
total: {
  $gte: value => target.gte(totalExpression, value), // value: number
  $lt: value => target.lt(totalExpression, value),   // value: number
}
```

Adira composes these leaves through the provider's `and`, `or`, and `not` operations. Backend authors do not implement every possible Boolean combination.

The contract should require coverage of all exposed operators, with defaults and custom overrides composing into a complete implementation. A full custom compiler can receive a derived discriminated union preserving field/operator/operand relationships and use exhaustive checking.

Do not treat leaf handlers as independent row-fetching callbacks. Cross-source predicates need a plan preserving the complete Boolean expression, or explicit rejection when unsupported. Applying filters to an already paginated subset is not equivalent to filtering before pagination.

For cross-source predicates, a symbolic result may contain application-side dependencies that must resolve before producing a database predicate. The common abstraction therefore needs an execution plan broader than a single database's predicate type.

### 7. Give field resolvers fixed output types and declared dependencies

```ts
const fromOrder = computed<OrderRow>();

const totalBinding = fromOrder(
  ["subtotal", "tax"],
  (row) => row.subtotal + row.tax,
);
```

The callback sees only declared dependencies. Its output must match the public field type. Relation bindings must match their resource, cardinality, and nullability.

Adira collects dependencies for the actual request and assembles the selected result. Application code should not need to manually construct every possible frontend-selected shape.

Prefer sharing a typed expression between output computation and filtering when supported by the provider. A custom output callback alone does not make a field filterable; filtering requires its own supported implementation.

### 8. Make relation filtering explicit

Use explicit collection quantifiers such as `$some` and `$none`, rather than ambiguous traversal through arrays. Conditions inside one `$some` must apply to the same element.

```text
not(some(P)) = no element satisfies P
some(not(P)) = an element exists that does not satisfy P
```

Filtering parent resources through a relation does not implicitly prune that relation in the response. Filtering returned children, if exposed, is a separate selection operation.

To-one relation predicates and collection quantifiers must be explicitly enabled. Their grammar and exact null/missing behavior still need specification.

### 9. Keep backend policy outside the client expression

```text
effective filter = backend scope AND client filter
```

A client negation cannot negate authorization, tenant, or other mandatory backend scope. Related resources need their own scope enforcement. Field exposure and filter permissions must be checked against endpoint capabilities.

### 10. Define the guarantees at each boundary

The specific frontend selection arrives at runtime. TypeScript can describe allowed requests and infer a client's selected result, but the backend does not acquire a new concrete compile-time type from an HTTP request.

| Boundary           | Static checks                                                 | Runtime responsibility                                         |
| ------------------ | ------------------------------------------------------------- | -------------------------------------------------------------- |
| Resource contract  | Field definitions and capabilities                            | Executable metadata and validators                             |
| Frontend request   | Allowed selections, predicates, operands, inferred output     | Strict parsing of incoming data                                |
| Field bindings     | Implementation coverage, output types, declared dependencies  | Loading dependencies and checking values                       |
| Filter compilation | Operator coverage, operand types, compatible predicate scopes | Preserving the expression and rejecting unsupported plans      |
| Planning           | Compatible fragments and dependencies                         | Coverage of the actual request; no silently ignored operations |
| Response assembly  | Selected client result type                                   | Projection, serialization, and shape validation                |

Composable primitives should produce plans that can be fused and optimized without requiring intermediate JavaScript arrays. Providers may implement whole subplans where that is more efficient. Reordering must preserve defined behavior.

Types and coverage checks cannot prove that arbitrary custom code calculates the correct value or returns every matching record. Custom providers remain trusted implementations of a specified contract. Use shared conformance tests and a reference evaluator for filter semantics, including nested negation, null/missing values, and relation quantifiers.

### 11. Mix database and application execution under the same API

One public resource can contain MongoDB-backed fields, custom MongoDB expressions or pipeline fragments, and fields or relations resolved through external services. A shared schema does not imply a shared data source.

The physical execution plan can be a dependency graph containing database operations, application computation, service requests, parsing/validation, and keyed relation assembly. Fuse compatible MongoDB work into native queries or pipelines where appropriate. Keep native computation in the database; custom application callbacks are explicit execution steps and are not automatically translated into MongoDB expressions.

For an external relation used only in the returned selection, a valid plan can be:

```text
MongoDB: backend scope → filters → sort → page → output fields + join keys
Application: batch external lookup → parse/validate → attach by key
Adira: final projection, serialization, and response validation
```

Pass the requested child selection to the resolver so it can map supported selections to the external API. If that API cannot project fields, fetch its supported representation and let Adira project the response. Preserve identity keys internally even when they were not selected. Parse external payloads against the external source's runtime schema, then map them through the public resource bindings.

External fields affecting parent membership, ordering, or pagination require a different plan. A remote search returning a complete matching key set can sometimes become a MongoDB membership predicate, after which the Boolean expression composes normally. An alternative is a deliberately bounded candidate-evaluation strategy with filtering before final pagination. Neither strategy is an automatic fallback.

Preserve the complete expression across sources: pushing only the local side of `localPredicate OR remotePredicate` into MongoDB loses valid rows. Negation requires defined missing/null semantics and an authoritative scope. A partial remote page, timeout, or failed lookup cannot be treated as a complete matching key set.

Initial preference: support MongoDB-native filtering plus batched external selection. Enable external filtering or sorting only when an implementation supplies a strategy covering the permitted expressions. Selection support alone does not imply filter or sort support.

Typed bindings must connect parent dependencies, lookup keys, parsed external data, and related resource output. Raw MongoDB stages and raw HTTP payloads remain boundaries requiring declared contracts and validation/conformance checks; their output shape is not proven merely by a `PipelineStage[]` annotation or a TypeScript cast.

### 12. Consider typed native and application phases for custom backend work

Mixed execution is useful even without external services. A backend can perform native MongoDB computation, then run custom TypeScript computation over the resulting rows.

Use builders that carry the current row shape and execution target, conceptually `Plan<Row, Target>`. Infer each native expression's output through typed constructors and each application callback's output through its return value. Avoid requiring developers to annotate every intermediate row shape or implement a TypeScript interpreter for all possible MongoDB syntax.

```ts
const plan = mongo
  .from(OrderModel)
  .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")))
  .project(["_id", "total"])
  .toApp({ batchSize: 256 })
  .derive("displayTotal", ["total"], (row) => row.total.toFixed(2));
```

This illustrates a backend fragment, not a complete request handler. Assume its source has numeric `subtotal` and `tax` fields. The native phase produces `_id` and numeric `total`. The application callback sees only its declared `total` dependency, and its string return value determines the `displayTotal` type. Projection removes fields from downstream inference.

Building a plan should be lazy. An explicit database-to-application boundary can stream or batch a cursor; it need not collect the complete result in memory. Batch size and concurrency are execution controls, with bounded buffering and defined output ordering. Global operations such as arbitrary sorting require an explicit appropriate strategy rather than an assumed streaming implementation.

Expose typed native helpers for common operations, reusable fragments, and an advanced raw-pipeline extension. Raw fragments need an input contract and a runtime output schema; infer their output type from that schema. Arbitrary pipeline syntax does not prove that its declared output is correct. Validate at execution boundaries and use conformance/integration tests for raw native work. Treat opaque fragments conservatively during optimization.

Operator constructors should distinguish their effects: a derived field preserves row count and sequence, filtering removes rows, and an arbitrary batch transform may change cardinality, identity, or ordering. Track dependencies and effects so optimization is conservative. Declared application dependencies can support demand-driven computation and loading; arbitrary callbacks must not be assumed pure or freely reordered.

Display-only derivation can run after final pagination when it cannot affect membership, ordering, or other required semantics. A custom value used in filtering or sorting must be computed before final pagination. Do not silently apply a frontend filter to an already limited database page.

Do not expose an implicit return to MongoDB after application transformation. Further database work must be an explicit operation, such as a keyed batch query with defined merge semantics. Querying the source collection again does not automatically include fields computed or modified in application memory.

Bind the fragment's produced fields to the public resource contract. The endpoint planner still owns actual request selection, filtering, sorting, pagination, and coverage checks. A well-typed handwritten sequence alone does not establish that every frontend instruction was fulfilled.

### 13. Preserve the Express inference bridge through the public executor

Keep the existing handler annotation pattern. Its type source should be the callable, managed executor bound to the public resource, rather than an intermediate database or application plan.

```ts
const getCategories = defineRead(CategoryResource, {
  source: categoryPlan,
});

export type GetCategoriesFn = typeof getCategories;

export const getCategoriesHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<GetCategoriesFn>>,
  res: Response<Backend.InferHandlerResponse<GetCategoriesFn> | ErrorResponse>,
) => {
  try {
    const categories = await getCategories(req.query);
    res.send(categories);
  } catch (err) {
    res.send({ error: true, message: String(err) });
  }
};
```

`CategoryResource` defines the published fields, including explicitly exposed computed fields. Binding must check that the plan or field implementations can produce those fields with compatible types. Storage-only dependencies and intermediate values are not inferred as public fields merely because they occur in the plan.

The executor carries public contract metadata. `InferHandlerParams` derives permitted requests, and `InferHandlerResponse` describes the flat response plus type-only metadata for generated client inference. Preserve extra handler output such as the existing `related` mechanism independently of the selected executor result.

Return the managed result directly, with rows at the response root. One proposed encoding is an opaque result containing `rows: readonly unknown[]` and a private required type marker identifying the public contract. Only the managed execution/finalization path constructs this result after request validation, execution coverage checks, projection, serialization, and result validation. Ordinary hand-built row objects then do not satisfy the Express success response type. Internal markers must not appear in JSON.

A non-generic Express handler receives a runtime selection and must not assume its result rows contain every public field. The generated client instead combines the public contract metadata with its concrete selection to infer the precise response. The existing `__base`/`HydrateResponse` mechanism already follows this general specialization pattern; its representation needs to evolve to capture the public resource and capabilities, rather than only the original storage model.

The generator can retain its explicit `Request<...>`/`Response<...>` discovery pattern. Contract metadata extraction and frontend hydration must support the new executor types, and generated declarations must depend on public contract types rather than backend execution implementations.

An opaque contract marker does not prove that a result belongs to a particular incoming query. The executor/HTTP adapter must retain and enforce that request/result association at runtime. A managed handler adapter can eventually own execution and sending, while the explicitly typed handler above remains the compatibility-oriented form.

### 14. Distinguish custom relation plans from custom predicate plans

Treat custom includes as relation bindings and custom filter leaves as predicate bindings. They share execution infrastructure but have different output contracts:

```text
RelationPlan<ParentScope, ChildResource, Cardinality>
PredicatePlan<ParentScope>
```

A relation binding specifies correlation keys, its child resource, cardinality/nullability, and a child plan. The child plan can contain custom native MongoDB stages followed by application transformations. Compatible native work can run inside a correlated `$lookup`; application suffixes run outside MongoDB, with child results attached to the correct parents by identity. A fully custom loader can use the same relation contract and return typed, keyed child results.

The relation planner receives the child's validated selection and any permitted child request operations. It retains required identity/dependency fields until execution finishes. A declared to-one relation must not accidentally duplicate parent rows, and to-many nested pagination applies per parent. Raw native fragments need declared input/output and effect contracts; their correctness is not inferred from arbitrary pipeline syntax.

A simple native predicate can compile directly to a MongoDB condition. A more complex native predicate can return preparation stages plus a Boolean test. For example, a backend-defined `hasActiveProducts` predicate can perform a correlated product lookup and test whether its result is non-empty. Such preparation must preserve parent membership and identity until the enclosing Boolean expression is evaluated. Filtering child documents inside the lookup does not itself remove the parent.

Do not concatenate arbitrary root-filtering pipelines for separate leaves. Root `$match` stages composed sequentially impose conjunction, which cannot implement arbitrary client `$or` or `$not`. A destructive custom pipeline can instead implement a complete filter subtree, or provide a complete matching key set under an explicit strategy. Those are different contracts from preparing and testing one leaf.

An application predicate declares dependencies and returns a Boolean decision per candidate. A batch variant must account for each candidate by stable identity, without treating an incomplete result or failure as a definitive false result. Leaf factory inputs come from the contract's exact field/operator operand types. Each returned predicate plan is tied to its compatible parent scope.

For a mixed expression, MongoDB may prepare native truth values while the application evaluates the remaining Boolean tree using those values and application predicates. Push native conjuncts only when they are necessary conditions of the complete expression. Never push just the local branch of `nativePredicate OR applicationPredicate`. Apply final pagination after all membership tests; native ordering can still be useful when filtering preserves that sequence. Application-defined ordering needs its own strategy.

Use the same scoped relation definition for loading and related-resource predicates, but do not assume the selected relation payload is sufficient for filtering. A child selection may omit predicate dependencies or return only a limited page; relation existence/quantifier tests must use the appropriate untruncated relation scope.

Resource binding checks relation output shape and predicate implementation coverage. Managed execution checks the actual request's plan and final result. Registering these custom providers does not change the `GetCategoriesFn` → `InferHandlerParams` / `InferHandlerResponse` → generated client bridge.

## Open questions to refine next

- What is the public contract-authoring API, and how much metadata can be derived from existing models?
- Should a selection tree replace `include`/`select`, coexist with them, or be an alternative syntax? What does omitted selection mean?
- What are the exact semantics for empty predicates/groups, null versus missing values, string comparison, and serialized dates?
- Which relation quantifiers and nested selection arguments belong in the first version? How are related-field sorting and pagination constrained?
- How should custom sources expose projection-aware loading while preserving dependency checks?
- What is the smallest useful provider/plan-fragment interface, including handling whole subplans and composing different execution sources?
- What exact constructors distinguish native predicate preparation/test plans, complete-subtree implementations, and complete matching-key-set strategies? How are parent-preserving effects declared for raw fragments?
- How should fluent phase builders relate to declarative field bindings? Which native operators get typed helpers first, and what effects and contracts must raw or opaque transforms declare?
- How do mixed execution plans declare remote predicate dependencies and complete key-set requirements? What consistency and failure behavior is promised across sources?
- Which limits are resource-wide versus endpoint-specific, and how are unsupported or over-budget requests reported?
- How do we migrate existing `groupBy`, aggregation, and `pickDistinct` usage and version the generated contract?

## Initial implementation path

The initial slice is implemented in the additive `defineRead` API. Further work can refine its semantics and decide how to migrate existing `buildGetHandler` callers after exercising the prototype.

Current starting points: [backend execution](packages/backend/generate-handler.ts), [query and shape types](packages/core/src/index.ts), and [backend inference helpers](packages/core/src/helpers/backend.ts).
