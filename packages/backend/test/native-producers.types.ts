import { defineResource, field, schema } from "@n/adira.core.ts";
import {
  createReadContext,
  defineRead,
  mongo,
  type PlanContext,
  type PlanRow,
} from "../read";
import { Categories, Products } from "./fixtures";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

const base = mongo.from(Categories);
const output = schema.object({
  stockTotal: schema.number(),
  count: schema.number(),
});
const producer = base.native({
  provides: ["stockTotal", "count"],
  requires: ["_id"],
  stages: [{ $set: { stockTotal: 0, count: 0 } }],
  output,
});
type Total = Expect<Equal<PlanRow<typeof producer>["stockTotal"], number>>;
type KeptName = Expect<Equal<PlanRow<typeof producer>["name"], string>>;
type KeptId = Expect<
  Equal<PlanRow<typeof producer>["_id"], PlanRow<typeof base>["_id"]>
>;
const computed = producer.derive("doubled", (e) =>
  e.multiply(e.field("stockTotal"), e.literal(2)),
);
type Doubled = Expect<Equal<PlanRow<typeof computed>["doubled"], number>>;
const projected = computed.project(["name", "doubled"]);
type Projected = Expect<
  Equal<PlanRow<typeof projected>, { name: string; doubled: number }>
>;
const app = producer
  .toApp()
  .derive("label", ["stockTotal"], ({ stockTotal }) => stockTotal.toFixed(2));
type Label = Expect<Equal<PlanRow<typeof app>["label"], string>>;
const Resource = defineResource({
  name: field.string(),
  stockTotal: field.number().filterable("$gte").orderable(),
});
const read = defineRead(Resource, { source: producer });
const result = read({
  select: { stockTotal: true },
  where: { stockTotal: { $gte: 1 } },
});
type Selected = Expect<
  Equal<Awaited<typeof result>["rows"][number], { readonly stockTotal: number }>
>;
// @ts-expect-error Output cannot be bound as a different public scalar type.
defineRead(defineResource({ stockTotal: field.string() }), {
  source: producer,
});
base.native({
  provides: ["stockTotal", "count"],
  // @ts-expect-error Dependencies must exist in the input row.
  requires: ["missing"],
  stages: [],
  output,
});
base.native({
  provides: ["stockTotal", "count"],
  // @ts-expect-error A producer cannot depend on its own new output.
  requires: ["stockTotal"],
  stages: [],
  output,
});
base.native({
  // @ts-expect-error Provided names must be actual output schema fields.
  provides: ["stockTotal", "count", "missing"],
  requires: [],
  stages: [],
  output,
});
// @ts-expect-error Every output schema field must be declared as provided.
base.native({ provides: ["stockTotal"], requires: [], stages: [], output });
// @ts-expect-error Producer dependencies are explicit, including an empty array.
base.native({ provides: ["stockTotal", "count"], stages: [], output });
// @ts-expect-error Requires is not accepted without provides.
base.native({ requires: ["_id"], stages: [], output });
base.native({
  provides: ["stockTotal", "count"],
  requires: [],
  // @ts-expect-error Producer and unconditional-transform contracts cannot be mixed.
  preserves: ["name"],
  stages: [],
  output,
});
const incomplete = {
  provides: ["stockTotal"] as const,
  requires: [] as const,
  stages: [],
  output,
};
// @ts-expect-error Assigned options cannot silently fall through to the raw overload.
base.native(incomplete);

const replaced = base.native({
  provides: ["name"],
  requires: ["name"],
  stages: [{ $set: { name: 7 } }],
  output: schema.object({ name: schema.number() }),
});
type Replaced = Expect<Equal<PlanRow<typeof replaced>["name"], number>>;
type Retained = Expect<Equal<PlanRow<typeof replaced>["tax"], number>>;

type Context = { tenant: string };
const backend = createReadContext<Context>();
const contextual = backend.mongo.from(Categories).native({
  provides: ["stockTotal", "count"],
  requires: ["_id"],
  stages: [],
  output,
});
type KeptContext = Expect<Equal<PlanContext<typeof contextual>, Context>>;
const scopedRead = backend.defineRead(Resource, { source: contextual });
// @ts-expect-error A producer does not erase the required backend context.
scopedRead({ select: { stockTotal: true } });
scopedRead({ select: { stockTotal: true } }, { tenant: "demo" });

const related = base.related(mongo.from(Products), {
  localField: "_id",
  foreignField: "category",
});
const child = related.native({
  provides: ["score"],
  requires: ["stock"],
  stages: [{ $set: { score: { $multiply: ["$stock", 2] } } }],
  output: schema.object({ score: schema.number() }),
});
type ChildOutput = Expect<Equal<PlanRow<typeof child>["score"], number>>;
type ChildName = Expect<Equal<PlanRow<typeof child>["name"], string>>;
const item = defineResource({ name: field.string(), score: field.number() });
child.many(item).sum({ field: "score" });
related.native({
  provides: ["score"],
  // @ts-expect-error Relation producers also check input dependencies.
  requires: ["missing"],
  stages: [],
  output: schema.object({ score: schema.number() }),
});
// @ts-expect-error Relation producers also check output coverage.
related.native({ provides: ["stockTotal"], requires: [], stages: [], output });
const raw = base.native({
  stages: [],
  output: schema.object({ value: schema.string() }),
});
type RawShape = Expect<Equal<PlanRow<typeof raw>, { readonly value: string }>>;
