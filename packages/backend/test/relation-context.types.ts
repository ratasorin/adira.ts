/** Inference checks for association before native/application transformations. */
import { defineResource, field, schema } from "@n/adira.core.ts";
import { defineRead, mongo, type PlanRow } from "../read";
import {
  Categories,
  Products,
  categorySource,
  productSource,
} from "./fixtures";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

const related = categorySource.related(productSource, {
  localField: "_id",
  foreignField: "category",
});
const totals = related.native({
  stages: [{ $group: { _id: null, stock: { $sum: "$stock" } } }],
  output: schema.object({ stock: schema.number() }),
});
type NativeOutput = Expect<
  Equal<PlanRow<typeof totals>, { readonly stock: number }>
>;
const Total = defineResource({ stock: field.number() });
const summary = totals.one(Total);
const parent = categorySource.load(
  "summary",
  summary.get({ select: { stock: true } }),
);
type LoadedTotal = Expect<
  Equal<PlanRow<typeof parent>["summary"], { readonly stock: number } | null>
>;

const projected = related.project(["name"]);
type Projected = Expect<Equal<PlanRow<typeof projected>, { name: string }>>;
const labels = projected
  .toApp()
  .map(async ({ name }) => ({ label: name.toUpperCase() }));
type Mapped = Expect<Equal<PlanRow<typeof labels>, { label: string }>>;
const Label = defineResource({ label: field.string() });
const formatted = labels.many(Label);
const loaded = categorySource.load(
  "labels",
  formatted.all({ select: { label: true } }),
);
type LoadedLabels = Expect<
  Equal<PlanRow<typeof loaded>["labels"][number], { readonly label: string }>
>;

const batched = related
  .toApp()
  .transformBatch((rows) => rows.map(({ name }) => ({ label: name })));
type Batched = Expect<Equal<PlanRow<typeof batched>, { label: string }>>;
batched.many(Label);

related
  .derive("double", (e) => e.multiply(e.field("stock"), e.literal(2)))
  .toApp()
  .derive("text", ["double"], ({ double }) => double.toFixed(2))
  .use((plan) => plan.map(({ text }) => ({ label: text })))
  .many(Label);

// The initial join is checked against source input fields.
// @ts-expect-error Unknown child join field.
categorySource.related(productSource, {
  localField: "_id",
  foreignField: "missing",
});
// @ts-expect-error Unknown parent join field.
categorySource.related(productSource, {
  localField: "missing",
  foreignField: "category",
});
// @ts-expect-error String parent values do not match ObjectId child values.
categorySource.related(productSource, {
  localField: "name",
  foreignField: "category",
});

// Transforms see only the current payload, while the relation keeps ownership.
totals.toApp().map((row) => {
  // @ts-expect-error Original join keys are not exposed in the new payload.
  row.category;
  return row;
});
// @ts-expect-error A numeric output cannot implement a string resource field.
totals.one(defineResource({ stock: field.string() }));
// @ts-expect-error Missing required public field.
labels.many(defineResource({ label: field.string(), missing: field.number() }));
// @ts-expect-error Application plans cannot append native stages.
labels.native({
  stages: [],
  output: schema.object({ label: schema.string() }),
});
related.native({
  stages: [],
  output: schema.object({ stock: schema.number() }),
  // @ts-expect-error No key-preservation declaration is needed or accepted after association.
  preserves: ["category"],
});
// @ts-expect-error A relation-scoped computation cannot be used as an unscoped root.
defineRead(Total, { source: totals });

const NeedsPredicate = defineResource(
  { label: field.string() },
  {
    predicates: { visible: field.boolean().filterable("$eq") },
  },
);
// @ts-expect-error Required predicate implementation is still checked.
labels.many(NeedsPredicate);
labels.many(NeedsPredicate, {
  filters: {
    visible: {
      $eq: (expected) =>
        labels.appCondition({
          requires: ["label"],
          evaluate: ({ label }) => Boolean(label) === expected,
        }),
    },
  },
});

mongo.from(Products, {
  scope: (e) => e.eq(e.field("isActive"), true),
});
mongo.from(Products, {
  scope: (e) => {
    // @ts-expect-error Input policies see original source fields.
    e.field("computedLater");
    return e.eq(e.field("stock"), 1);
  },
});
mongo.from(Categories, {
  // @ts-expect-error Input policy must produce a Boolean MongoDB expression.
  scope: (e) => e.field("name"),
});

export {};
