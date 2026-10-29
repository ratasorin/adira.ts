# Typed backend context

Declare your application's context once:

```ts
import { createReadContext } from "@n/adira.backend.ts";

type RequestContext = {
  tenantId: string;
  inventory: InventoryService;
};

export const reads = createReadContext<RequestContext>();
```

Build sources and readers through this factory. Existing resource definitions remain unchanged.

```ts
const categories = reads.mongo.from(Category);
const summaries = categories.related({
  requires: ["_id"],
  output: schema.object({ stock: schema.number() }),
  resolveBatch: async ({ parents, context }) => {
    // RequestContext is inferred, including service methods.
    const totals = await context.inventory.stockTotals({
      tenantId: context.tenantId,
      categoryIds: parents.map(({ row }) => row._id),
    });
    return parents.map(({ ref, row }) => ({
      ref,
      rows: [{ stock: totals.get(String(row._id)) ?? 0 }],
    }));
  },
});

const getCategories = reads.defineRead(CategoryResource, {
  source: categories,
  relations: { summary: summaries.one(StockResource) },
});
```

Context is inferred in source policies, reader/relation scopes, application predicates, `resolveBatch`, and application `derive`, `map`, `filter`, and `transformBatch` callbacks. It survives native stages, `.toApp`, `.use`, nested relations, and relation dependencies. `PlanContext<typeof plan>` exposes its type alongside `PlanRow<typeof plan>`.

```ts
await getCategories(query, { tenantId: "tenant-1", inventory });
getCategories.inspect(query, { tenantId: "tenant-1", inventory });

// Compile-time errors:
await getCategories(query); // Context is required.
await getCategories(query, { tenantId: 123 }); // Wrong/missing fields.
```

The same context object reaches every executed callback. A factory stores no per-request context, so reuse it across concurrent requests. Construct context in your Express handler/middleware from application services and authenticated request information. The [batch summary endpoint](../examples/backend/src/controller/batch-category-summary.ts) demonstrates typed service injection and the existing `Response<Backend.InferHandlerResponse<Fn> | ErrorResponse>` annotation. Its context declaration is in [read-context.ts](../examples/backend/src/read-context.ts).

## Composition and compatibility

Sources that accept any context remain usable in a typed reader or as a child source. A context requiring `{ tenantId: string }` can also run under an application context that supplies that field plus additional services. A child requiring additional or incompatible fields is rejected. Reader scopes, predicate bindings, and loaded dependencies are checked against the source/factory context as well.

Consumption checks an execution-input interface instead of retyping the original fluent builder. This lets existing callbacks retain their original requirements while newly composed callbacks infer the consuming context. Generic reusable builder fragments should carry their context parameter through their input and output types.

Existing `mongo.from(...)` and standalone `defineRead(...)` readers retain optional `unknown` context. Standalone `defineRead` also infers a typed source's context automatically. Using `reads.defineRead` explicitly makes the application context required even when its source is context-independent.

## Runtime and generated contracts

Contextual readers reject missing/null context before source access, both for execution and inspection. Field/service compatibility is checked by TypeScript, not inferred from runtime objects; validate untrusted context at your application's boundary. The factory does not construct services or validate authentication.

Only the resource/query/response contract is published to frontend declarations. The generator removes the backend context argument from Adira's `ReadExecutor` references before collecting its dependencies and emitting public declarations. Backend context interfaces and services used only through that argument are excluded. Request context never becomes a client query parameter or a response field.

See [type checks](../packages/backend/test/read-context.types.ts) and [runtime cases](../packages/backend/test/read-context.cases.ts).
