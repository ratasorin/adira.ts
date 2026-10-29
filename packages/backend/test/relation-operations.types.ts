/** Compile-only checks; examples marked @ts-expect-error must remain invalid. */
import { defineResource, field } from "@n/adira.core.ts";
import { defineRead, type PlanRow } from "../read";
import { categorySource, relations } from "./fixtures";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

const products = relations.products;
const source = categorySource
  .load("productCount", products.count())
  .load("available", products.exists({ where: { stock: { $gte: 1 } } }))
  .load("stockTotal", products.sum({ field: "stock" }))
  .load("stockAverage", products.avg({ field: "stock" }))
  .load("stockMinimum", products.min({ field: "stock" }))
  .load("stockMaximum", products.max({ field: "stock" }))
  .load(
    "firstProduct",
    products.first({ select: { name: true }, orderBy: { stock: "asc" } }),
  )
  .load(
    "lastProduct",
    products.last({ select: { stock: true }, orderBy: { stock: "asc" } }),
  )
  .load("creator", relations.createdBy.get({ select: { initials: true } }));
type Row = PlanRow<typeof source>;
type Count = Expect<Equal<Row["productCount"], number>>;
type Exists = Expect<Equal<Row["available"], boolean>>;
type Sum = Expect<Equal<Row["stockTotal"], number>>;
type Average = Expect<Equal<Row["stockAverage"], number | null>>;
type Minimum = Expect<Equal<Row["stockMinimum"], number | null>>;
type Maximum = Expect<Equal<Row["stockMaximum"], number | null>>;
type FirstName = Expect<
  Equal<NonNullable<Row["firstProduct"]>["name"], string>
>;
type LastStock = Expect<
  Equal<NonNullable<Row["lastProduct"]>["stock"], number>
>;
type Initials = Expect<Equal<NonNullable<Row["creator"]>["initials"], string>>;
declare const row: Row;
// @ts-expect-error first() may return null.
row.firstProduct.name;
// @ts-expect-error first() preserves exact selection.
row.firstProduct?.stock;
// @ts-expect-error get() preserves exact selection.
row.creator?.name;
// @ts-expect-error Numeric operations reject string fields.
products.sum({ field: "name" });
// @ts-expect-error Numeric operations reject relations/nonexistent fields.
products.avg({ field: "missing" });
// @ts-expect-error min() is a numeric reduction.
products.min({ field: "name" });
// @ts-expect-error Filters retain numeric operand types.
products.count({ where: { stock: { $gte: "1" } } });
// @ts-expect-error Unknown operators are rejected.
products.exists({ where: { stock: { $gte: 1, $bad: 2 } } });
// @ts-expect-error Aggregates cannot accept display pagination.
products.sum({ field: "stock", page: { limit: 1 } });
// @ts-expect-error count() has no selection or ordering options.
products.count({ select: { name: true } });
// @ts-expect-error Unknown options are rejected even with a valid field.
products.max({ field: "stock", typo: true });
// @ts-expect-error first() requires explicit ordering.
products.first({ select: { name: true } });
// @ts-expect-error An empty ordering is not sufficient.
products.last({ select: { name: true }, orderBy: {} });
// @ts-expect-error Ordering uses approved sortable fields.
products.first({ select: { name: true }, orderBy: { name: "asc" } });
products.first({
  // @ts-expect-error Unknown selected fields are rejected.
  select: { name: true, missing: true },
  orderBy: { stock: "asc" },
});
// @ts-expect-error get() is reserved for to-one bindings.
products.get({ select: { name: true } });
// @ts-expect-error count() is reserved for to-many bindings.
relations.createdBy.count();
// @ts-expect-error get() cannot accept ordering.
relations.createdBy.get({ select: { name: true }, orderBy: { id: "asc" } });

defineRead(defineResource({ stockAverage: field.number().nullable() }), {
  source,
});
// @ts-expect-error A possibly empty average cannot satisfy a non-nullable field.
defineRead(defineResource({ stockAverage: field.number() }), { source });

export {};
