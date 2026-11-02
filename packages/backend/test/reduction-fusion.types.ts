/** Fusion is an execution optimization; every fluent intermediate keeps its type. */
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
  .load("count", products.count())
  .load("sum", products.sum({ field: "stock" }))
  .load("average", products.avg({ field: "stock" }))
  .load("minimum", products.min({ field: "stock" }))
  .load("maximum", products.max({ field: "stock" }));
type Row = PlanRow<typeof source>;
type Count = Expect<Equal<Row["count"], number>>;
type Sum = Expect<Equal<Row["sum"], number>>;
type Average = Expect<Equal<Row["average"], number | null>>;
type Min = Expect<Equal<Row["minimum"], number | null>>;
type Max = Expect<Equal<Row["maximum"], number | null>>;
const Resource = defineResource({
  count: field.number(),
  sum: field.number(),
  average: field.number().nullable(),
  minimum: field.number().nullable(),
  maximum: field.number().nullable(),
});
const read = defineRead(Resource, { source });
export async function selectedOutput() {
  const data = await read({ select: { count: true, average: true } });
  const count: number = data.rows[0].count;
  const average: number | null = data.rows[0].average;
  // @ts-expect-error Fusion does not widen the frontend's selected response.
  data.rows[0].sum;
  // @ts-expect-error An empty average remains nullable.
  const nonNullable: number = data.rows[0].average;
  const plan = read.inspect({ select: { count: true, sum: true } });
  const phase: "membership" | "output" | undefined =
    plan.reductionGroups?.[0].phase;
  const names: readonly string[] | undefined =
    plan.dependencies.count.fusedWith;
  // @ts-expect-error Inspection group names are immutable.
  plan.reductionGroups?.[0].loads.push("extra");
  // @ts-expect-error A source's nullable reduction cannot bind a required numeric scalar.
  defineRead(defineResource({ average: field.number() }), { source });
  return { count, average, nonNullable, phase, names };
}
