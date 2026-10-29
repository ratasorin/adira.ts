# Composable reads: working prototype

The new API is exported from `@n/adira.core.ts`, `@n/adira.backend.ts`, and `@n/adira.client.ts`. It sits alongside the existing handlers. The new request language has selection, approved predicates, ordering, and pagination; it has no frontend `groupBy`, raw aggregation, or `pickDistinct`.

## Try it

From the repository root:

```sh
npm install
npm run demo:read
npm run test:read
```

Use Node.js 20+ and a local `mongod` on PATH, or set `MONGOD_BINARY` to its executable. The demo and integration tests start a private, temporary MongoDB database, seed it, and stop/remove it afterward. They do not connect to the existing demo database. No MongoDB binary is downloaded.

The final demo shows a custom native field producer in three requests: select only names, select computed stock/count, and filter by stock while returning only names. Its plans show when the entire custom lookup is omitted or included.

The demo prints seven queries, their MongoDB pipelines, application steps, and results, with resolver call counts for the first three. The fourth shows `.all()` alongside a paginated include; the fifth shows native count/exists, numeric aggregates, and first/last selection. The sixth shows relation-first native grouping; the seventh combines count/sum for all selected parents in one custom `resolveBatch` query. The type tests compile positive examples and `@ts-expect-error` examples, including intermediate row shapes. These tests run as part of `test:read`.

The existing example application also exposes **GET `/api/categories/composable`**. Run its existing seed and development commands to use your demo database. Its implementation is in [composable-categories.ts](../examples/backend/src/controller/composable-categories.ts); its public contract is in [resources/categories.ts](../examples/backend/src/resources/categories.ts).

**GET `/api/categories/batch-summary`** demonstrates a `resolveBatch` loader with a typed injected inventory service. Declare context once with [`createReadContext<Context>()`](read-context.md); source policies, scopes, predicates, and application callbacks infer it, and execution/inspection require it. See the [batch endpoint](../examples/backend/src/controller/batch-category-summary.ts).

## 1. Declare what the frontend can request

```ts
import { defineResource, field } from "@n/adira.core.ts";

const CreatorResource = defineResource({
  name: field.string(),
  displayName: field.string(),
  initials: field.string(),
});

const CategoryResource = defineResource(
  {
    id: field.string().orderable(),
    name: field.string().filterable("$eq", "$startsWith"),
    displayName: field.string(),
    createdBy: field.one(CreatorResource).nullable(),
  },
  {
    predicates: { eligible: field.boolean().filterable("$eq") },
  },
);
```

Descriptors provide both TypeScript types and runtime validation. Selectable, filterable, and sortable are separate capabilities. `eligible` is a named, backend-defined predicate; it does not become a selectable field. A relation's public type stays an object or `null`, rather than switching between an ID and an object.

## 2. Build a lazy plan with inferred intermediate types

```ts
import { mongo, type PlanRow } from "@n/adira.backend.ts";

// Assume a typed Mongoose model with subtotal, tax, and _id fields.
const native = mongo
  .from(OrderModel)
  .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")))
  .project(["_id", "total"]);

type NativeRow = PlanRow<typeof native>;
// { _id: ObjectId; total: number }

const mixed = native
  .toApp({ batchSize: 128, concurrency: 8 })
  .derive("label", ["total"], async (row) => row.total.toFixed(2));

type MixedRow = PlanRow<typeof mixed>;
// { _id: ObjectId; total: number; label: string }
```

The expression callback rejects unknown fields and arithmetic on strings. Projection removes fields from subsequent inference. An application derivation sees only its declared dependencies, and its awaited return type becomes the new field type. `PlanRow` exposes the current shape for editor inspection or explicit assertions.

Native `.derive()` computations are also lazy: the compiled pipeline includes only derivations needed by the request or by another retained operation. For example:

```ts
const source = mongo
  .from(OrderModel)
  .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")));
const Order = defineResource({
  name: field.string(),
  total: field.number().filterable("$gte").orderable(),
});
const read = defineRead(Order, { source });

read.inspect({ select: { name: true } }); // No $set for total.
read.inspect({ select: { total: true } }); // Computes total.
read.inspect({ select: { name: true }, where: { total: { $gte: 100 } } });
// Computes total because filtering needs it, even though it is not returned.
```

Dependencies include frontend/backend filtering, explicit/default ordering, relation keys, custom loader inputs, application derivations, and relation aggregates. Chained computations and overwritten field versions retain their declared order. The same pruning runs within direct/deferred relations and aggregate dependencies. An unused derivation is neither executed nor validated; selected or otherwise required derived values retain validation. Thus a child count can skip an unrelated computed price, while summing that price still computes and validates it. This does not move a required computation past filtering or pagination.

Custom MongoDB blocks can also participate in pruning: use `.native({ provides: ["stockTotal"], requires: ["_id"], stages, output })`. The output schema describes the provided fields, which are added to the inferred input row; existing fields remain available. Selection, filtering, ordering, or a downstream dependency activates the entire block once. See [native field producers](native-field-producers.md) for an executable lookup/group example and the parent-preservation enforcement analysis.

Opaque application `map`, `filter`, and `transformBatch` callbacks can observe the complete input, so their preceding native fields remain available. Unconditional `.native({ stages, output })` blocks and the fields they could observe also remain: their stages can change membership, cardinality, or ordering and do not declare field dependencies. A preceding `.project(...)` bounds that observable input. Raw transform output schemas retain validation of their declared fields, including unselected fields. Neither form automatically interprets arbitrary MongoDB expressions to discover dependencies.

`toApp()` changes the builder type without executing it. Application plans expose `load`, `derive`, `map`, `filter`, and `transformBatch`; native aggregation methods are no longer available. `transformBatch` operates on each cursor batch and may change its membership/order. It does not imply a global transformation of the entire result.

A to-many relation binding exposes `.all({ select, where, orderBy })` to declare complete inputs for a computation. Consume it with `.load("inputs", relation.all(...))`, then derive from the inferred intermediate field. This supports nested relation selections; display pagination is rejected at every level. Count/exists, sum/avg/min/max, first/last, and to-one get also return typed dependencies, using native MongoDB execution when eligible. See the [relation-dependent field guide](relation-dependent-fields.md) for result/null semantics, scheduling, and fallback rules. The example categories endpoint exposes `stockTotal`, `productCount`, `hasProducts`, `stockAverage`, and `topProductName` this way.

Database-specific conversions such as `upper`, `lower`, and `toString` stay native. If a predicate needs those conversions on an application-produced field, provide an explicit `appCondition` callback; the planner rejects an automatic conversion fallback whose semantics may differ between runtimes.

Both phases support `.use(plan => ...)` for reusable typed fragments. A fragment must keep the same source. Raw native stages use a runtime schema to infer their output:

```ts
import { schema } from "@n/adira.core.ts";

const scores = mongo.from(OrderModel).native({
  stages: [{ $project: { _id: 0, score: { $multiply: ["$subtotal", 2] } } }],
  output: schema.object({ score: schema.number() }),
});
// PlanRow<typeof scores> is { score: number }.
```

There is no unchecked `.native<DesiredOutput>()` generic. Runtime checks catch malformed raw output. For relations, establish `.related(source, join)` before transformations, then finish with `.one(Resource)` or `.many(Resource)`. The scoped native output needs no join field or `preserves` declaration. Root/native source fragments retain the legacy optional `preserves` declaration for later direct bindings; it remains a provider promise. See the [relation-first workflow guide](native-pipeline-correlation.md).

Resource binding checks scalar compatibility on the resource argument itself, including `.one`, `.many`, and `defineRead`. For example, binding a numeric plan field to `field.string()` produces a native TypeScript diagnostic identifying `fields.stock.value` and `string` versus `number`, rather than asking for a second options argument. Missing fields identify `missingFromPlan` and the field name; nullable/broad output mismatches expose `expected` and `received` types through `outputTypeMismatch`. These are diagnostic-only type descriptions: resolve the mismatch in the plan or public resource. `npm run test:diagnostics -w packages/backend` checks the actual compiler messages and their locations without a compiler plugin.

## 3. Bind custom includes and predicates through the same source

For full control over batch retrieval, use `.related({ requires, output, resolveBatch })`. The callback returns complete candidates associated by opaque parent references; Adira applies approved filtering, ordering, pagination, and projection afterward. It supports the same final `.one`/`.many` bindings, application transformations, and relation dependencies. See the [custom loader guide](resolve-batch.md) and [typed batch aggregation example](../examples/backend/src/controller/batch-category-summary.ts).

This is a complete binding sketch for the contract above, assuming typed `Category` and `User` Mongoose models:

```ts
import { defineRead, mongo } from "@n/adira.backend.ts";

const creatorSource = mongo
  .from(User)
  .where((e) => e.isNull(e.field("deletedAt")))
  .derive("displayName", (e) => e.upper(e.field("name")))
  .toApp()
  .derive("initials", ["name"], (user) =>
    user.name
      .split(/\s+/)
      .map((part) => part[0])
      .join(""),
  );

const categorySource = mongo
  .from(Category)
  .derive("id", (e) => e.toString(e.field("_id")))
  .toApp()
  .derive("displayName", ["name", "isActive"], (row) =>
    row.isActive ? row.name : `${row.name} (inactive)`,
  );

const getCategories = defineRead(CategoryResource, {
  source: categorySource,
  scope: () => categorySource.condition((e) => e.isNull(e.field("deletedAt"))),
  defaultOrderBy: { id: "asc" },
  relations: {
    createdBy: categorySource.one(CreatorResource, {
      plan: creatorSource,
      localField: "createdBy",
      foreignField: "_id",
    }),
  },
  filters: {
    eligible: {
      $eq: (expected) =>
        categorySource.appCondition({
          requires: ["name", "isActive"],
          evaluate: (row) =>
            (row.isActive && row.name.length >= 5) === expected,
        }),
    },
  },
});
```

`expected` is inferred as `boolean`. The callback gets a readonly pick of its dependencies. The source must produce every public scalar with a compatible type. All public relations and named predicates need implementations. Ordinary scalar predicates have built-in implementations and can be overridden per operator. Incompatible join key types and relation cardinalities fail type checking.

For a native leaf, return `categorySource.condition(e => ...)`. For a custom pipeline leaf, return `pipelineCondition({ requires, stages, output, preservesRows: true, test })`. Its `test` callback sees the schema-inferred preparation output as well as source fields. The example endpoint implements `hasAvailableProducts` with a `$lookup` and a typed array-size test.

Predicate preparation may only add declared new fields using `$lookup`, `$set`, or `$addFields`. A `$match` _inside_ the lookup can restrict its children. A root `$match` cannot implement a leaf: it would discard parents required by other branches of an enclosing `$or`. The library snapshots each leaf's truth value, then combines the complete Boolean tree.

For compatible relation plans, the child's native prefix runs inside `$lookup` and its requested application suffix runs afterward. If parent filtering needs application work, display relations load after the final parent page through batched parent lookups. Native grouping, limits, ranks, and application callbacks retain their per-parent input context in both paths. To-many selection uses `.many(...)`, with filtering, sorting, and pagination independently applied per parent. To-one selection detects multiple matches; missing nullable relations return `null`, and missing required relations fail.

Required input policies belong in `mongo.from(Model, { scope: (expressions, context) => ... })`, before native transformations. Reader/binding `scope` conditions still operate over transformed rows. `.inspect(query).relationStrategies` reports `lookup` or `batched-lookup` for selected relations.

## 4. Keep your Express response annotation

```ts
type GetCategoriesFn = typeof getCategories;

export const getCategoriesHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<GetCategoriesFn>>,
  res: Response<Backend.InferHandlerResponse<GetCategoriesFn> | ErrorResponse>,
) => {
  try {
    res.send(await getCategories(req.query));
  } catch (error) {
    res
      .status(error instanceof ReadValidationError ? 400 : 500)
      .send({ error: true, message: String(error) });
  }
};
```

The existing generator can discover this signature. The callable executor's type exposes the public resource through core types; its inferred declaration does not need private plan types. The generated client specializes the response for its concrete request:

```ts
const result = await api(
  "/categories/composable",
  "GET",
)({
  query: {
    select: {
      name: true,
      createdBy: { select: { displayName: true, initials: true } },
    },
    where: {
      $or: [
        { name: { $startsWith: "A" } },
        { $not: { eligible: { $eq: false } } },
      ],
    },
    page: { limit: 20 },
  },
}).run();

if (!("error" in result)) {
  result.rows[0].createdBy?.initials; // string | undefined
  // result.rows[0].slug;             // TypeScript error
}
```

The client sends the tree in a single JSON `query` parameter, preserving booleans/numbers and avoiding Express query parser depth limits. No POST or route change is required. A manually constructed request can use `?query=<URL-encoded JSON>`.

The server receives a runtime selection, so a broad handler request has schema-shaped rows whose fields are optional. Literal queries retain their exact selected fields. The executor returns an opaque managed result after validation; a plain `{ rows: [...] }` cannot satisfy the handler's success response type. The marker is type-only and is absent from JSON. Literal queries used directly by backend code also infer their exact selected result.

Core `when(condition, () => part)` preserves a lazy query part's literal type and returns `undefined` when disabled. Selections can use it directly, for example `initials: when(showInitials, () => true)` or `createdBy: when(includeCreator, () => ({ select: { name: true } }))`. Conditional fields are optional in the inferred row, and selected children retain their field types and relation nullability. The parser skips undefined selections and still requires at least one enabled field at each selected level. `normalizeReadQuery(resource, query)` validates first, then returns a literal-shaped query with undefined selections and optional query properties omitted recursively; filter operands, including `false`, `0`, and `null`, remain intact. The dashboard's `deriveQuery` wrapper uses this normalizer. See the [progressive query examples](../examples/stress/docs/query-api.md) for controls, nested callbacks, and inferred row types.

## Execution guarantees and current boundaries

- The complete query is parsed before constructing providers or reading MongoDB. Unsupported keys and operands fail, including frontend grouping. Depth, node count, operand size, UTF-8 query size, page size, and fallback candidates have limits.
- Backend scope is ANDed outside client predicates. Client negation cannot remove it. Relations apply their own source policies.
- Native pagination is used when filtering and ordering can run natively and source application work preserves membership. Otherwise final pagination follows filtering and sorting. In `native OR application`, neither branch is silently discarded. Over-budget fallback evaluation fails instead of returning a partial page.
- Application derivations declare dependencies and run only when selected or needed by another operation. Opaque `map`/`transformBatch` callbacks are handled conservatively. Configure deterministic ordering, ideally including a unique tie-breaker, when pages must be repeatable.
- Built-in scalar filters use two-valued semantics: missing is treated as `null`; null comparisons are false; `$not` negates the complete Boolean result. Strings use case-sensitive matching. Empty `where` is true; empty `$and`/`$or` arrays are rejected.
- This is an opt-in prototype with one native prefix followed by an application suffix, bounded offset pagination, and MongoDB-backed keyed relations. Automatic relation quantifiers (`$some`/`$none`), external relation loaders, cursor pagination, provider-neutral adapters, and returning to MongoDB after app work remain future work. Backend-defined relation predicates already work through named preparations.
- TypeScript and runtime output schemas check shapes and capabilities. They cannot prove that arbitrary callbacks, raw stages, or source interfaces implement the intended business meaning. Raw providers remain trusted code and need integration/conformance tests. The explicitly typed Express handler can also call the executor with a different query; the opaque marker does not prove request/result identity.

See [read.types.ts](../packages/backend/test/read.types.ts), [read.test.ts](../packages/backend/test/read.test.ts), and [ARCHITECTURE.md](../ARCHITECTURE.md) for executable checks and the remaining design questions.
