# Index-compatible predicates

Adira adds ordinary MongoDB match conditions for supported field comparisons, alongside the existing exact aggregation expressions. This lets MongoDB use appropriate existing indexes without changing frontend queries, backend declarations, or inferred types. It does not create indexes, apply hints, or guarantee that MongoDB chooses an index for every query.

For example, this source policy keeps its existing API:

```ts
const source = backend.mongo.from(Orders, {
  scope: (e, context) => e.eq(e.field("tenantId"), context.tenantId),
});
```

Its first compiled stage now contains both tests:

```ts
{
  $match: {
    tenantId: { $eq: tenantId }, // Index-compatible candidate filter.
    $expr: {
      $eq: [{ $ifNull: ["$tenantId", null] }, { $literal: tenantId }],
    }, // Exact policy, before native computations.
  },
}
```

## Supported comparisons

- Positive scalar `$eq` and `$in` for strings, booleans, finite numbers, null, valid dates, and BSON ObjectIds. Public query operands still follow the resource's declared operators and operand types; this does not introduce new public types.
- Numeric `$gt`, `$gte`, `$lt`, and `$lte` with finite bounds.
- Backend expression `eq`, `isNull`, `gt`, and `gte`, composed through `and` and `or`. Source policies, native `.where(...)`, custom `.condition(...)`, and ordinary frontend filters use the same compiler metadata.

AND retains any supported necessary conditions. OR needs a necessary condition from every branch; an application-only or unsupported branch cannot be discarded. `$not`, `$ne`, and `$nin` keep exact expression evaluation without negating an approximate index condition. String search, computed expressions, and unannotated raw expressions also keep their existing path.

## Correctness and placement

Ordinary Mongo equality can match an array containing a scalar, whereas Adira's scalar expression compares the entire value. The ordinary match is therefore only a candidate filter; the exact test remains authoritative. This also prevents an array-valued tenant field from bypassing a scalar source policy.

Null needs a further guard: `$ifNull` treats missing and legacy BSON undefined as null, while MongoDB 8 ordinary equality to null excludes BSON undefined. Necessary null matches include `$type: "undefined"`, preserving those candidates for the exact check. See MongoDB's [undefined migration guide](https://www.mongodb.com/docs/manual/reference/bson-types/migrate-undefined/) and [`$ifNull` semantics](https://www.mongodb.com/docs/manual/reference/operator/aggregation/ifnull/).

Frontend index matches follow the existing predicate-placement analysis. They cannot move ahead of a field's last writer, a global computation, an opaque transform, or an application-produced value. An overwritten/computed field can receive an ordinary match after its writer without becoming a stored-field index lookup. Native preparations retain their existing execution boundaries. Child reads and complete reductions use the same compiler.

Source policies evaluate once per compilation using that request's typed context. Their exact checks stay before business stages. `.inspect()` exposes the generated matches; MongoDB `explain("executionStats")` establishes whether a particular plan actually uses an index.

The [regression cases](../packages/backend/test/index-lowering.cases.ts) exercise a real compound index without hints, exact access checks on malformed data, literal/BSON operands, null/missing/array behavior, conservative Boolean composition, raw-expression fallback, and field/global barriers. The dashboard before/after measurements are recorded in the [benchmark comparison](../examples/stress/reports/index-lowering-comparison.md).
