/**
 * Compile-time checks for relation-dependent computed fields.
 *
 * Compile with: npx tsc -p packages/backend/tsconfig.type-tests.json
 * Do not execute this file: some expressions intentionally fail type checking.
 * All APIs below are implemented; this file verifies their inferred types.
 * No database is accessed by this check.
 */
import { defineResource, field } from "@n/adira.core.ts";
import { defineRead, type PlanRow } from "../read";
import { categorySource, ProductResource, relations } from "./fixtures";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

// 1. Reuse the already-declared products relation, selecting only stock.
const products = relations.products;
const stockDependency = products.all({
  select: { stock: true },
  where: { stock: { $gte: 1 } },
});

// 2. Loading it adds a private, inferred intermediate field to the source row.
const withStock = categorySource.load("stockInputs", stockDependency);
type RowWithStock = PlanRow<typeof withStock>;
type ChildStockIsNumber = Expect<
  Equal<RowWithStock["stockInputs"][number]["stock"], number>
>;
declare const row: RowWithStock;

// @ts-expect-error Only selected child fields belong to this dependency.
row.stockInputs[0].name;
// @ts-expect-error Complete relation inputs are readonly arrays.
row.stockInputs.push({ stock: 1 });
products.all({
  select: { stock: true },
  // @ts-expect-error A complete dependency cannot accept display pagination.
  page: { limit: 1 },
});
products.all({
  // @ts-expect-error Dependency selection rejects nonexistent child fields.
  select: { stock: true, missing: true },
});
products.all({
  select: { stock: true },
  // @ts-expect-error Filter operands retain the child field's number type.
  where: { stock: { $gte: "1" } },
});

// 3. The existing derive callback sees the loaded input and infers its output.
const total = withStock.derive(
  "stockTotal",
  ["stockInputs"],
  ({ stockInputs }) =>
    stockInputs.reduce((sum, product) => sum + product.stock, 0),
);
type TotalIsNumber = Expect<Equal<PlanRow<typeof total>["stockTotal"], number>>;

withStock.derive("bad", ["stockInputs"], (input) => {
  // @ts-expect-error Other source fields were not declared as dependencies.
  return input.name;
});

const asyncTotal = withStock.derive(
  "stockTotal",
  ["stockInputs"],
  async ({ stockInputs }) =>
    stockInputs.reduce((sum, product) => sum + product.stock, 0),
);
type AsyncTotalIsNumber = Expect<
  Equal<PlanRow<typeof asyncTotal>["stockTotal"], number>
>;

// 4. The existing resource binding verifies the public computed output type.
// stockInputs stays private because it is absent from this public resource.
const Resource = defineResource({
  name: field.string(),
  stockTotal: field.number().filterable("$gte"),
});
defineRead(Resource, { source: total });
defineRead(Resource, { source: asyncTotal });

const wrong = withStock.derive("stockTotal", ["stockInputs"], () => "wrong");
// @ts-expect-error A string computation cannot fulfill the public numeric field.
defineRead(Resource, { source: wrong });

// A to-one relation needs its own cardinality-aware dependency API.
// @ts-expect-error all() is restricted to collection relations.
relations.createdBy.all({ select: { name: true } });
categorySource
  .map(() => ({ name: "missing key" }))
  // @ts-expect-error Loading requires a row compatible with the relation's parent.
  .load("inputs", stockDependency);

const CategoryWithProducts = defineResource({
  name: field.string(),
  products: field.many(ProductResource),
});
const categories = categorySource.many(CategoryWithProducts, {
  plan: categorySource,
  localField: "_id",
  foreignField: "_id",
  relations: { products },
});
const nested = categorySource.load(
  "inputs",
  categories.all({
    select: { products: { select: { stock: true } } },
  }),
);
type NestedStockIsNumber = Expect<
  Equal<
    PlanRow<typeof nested>["inputs"][number]["products"][number]["stock"],
    number
  >
>;
categories.all({
  select: {
    products: {
      select: { stock: true },
      // @ts-expect-error Complete nested collections cannot accept pagination either.
      page: { limit: 1 },
    },
  },
});
categories.all({
  select: {
    products: {
      // @ts-expect-error Nested selections reject unknown fields.
      select: { stock: true, missing: true },
    },
  },
});

export {};
