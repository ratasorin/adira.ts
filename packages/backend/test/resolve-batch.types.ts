import { Backend, defineResource, field, schema } from "@n/adira.core.ts";
import { defineRead, type BatchParentRef, type PlanRow } from "../read";
import { categorySource, productSource } from "./fixtures";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

const balances = categorySource.related({
  requires: ["tenant"],
  output: schema.object({ balance: schema.number() }),
  resolveBatch: async ({ parents, context }) => {
    type Parent = Expect<
      Equal<(typeof parents)[number]["row"], Readonly<{ tenant: string }>>
    >;
    type Context = Expect<Equal<typeof context, unknown>>;
    for (const parent of parents) {
      // @ts-expect-error Only declared parent dependencies are visible.
      parent.row.name;
      // @ts-expect-error Parent inputs are read-only.
      parent.row.tenant = "other";
      // @ts-expect-error Parent references are opaque.
      const fabricated: BatchParentRef = {};
    }
    return parents.map(({ ref, row }) => ({
      ref,
      rows: [{ balance: row.tenant.length }],
    }));
  },
});
type Output = Expect<
  Equal<PlanRow<typeof balances>, { readonly balance: number }>
>;
const Balance = defineResource({
  balance: field.number().filterable("$gte").orderable(),
});
const binding = balances.one(Balance);
const loaded = categorySource.load(
  "balance",
  binding.get({ select: { balance: true } }),
);
type Loaded = Expect<
  Equal<PlanRow<typeof loaded>["balance"], { readonly balance: number } | null>
>;
const read = defineRead(
  defineResource({ summary: field.one(Balance).nullable() }),
  {
    source: categorySource,
    relations: { summary: binding },
  },
);
async function responseEnvelope() {
  const result = await read({
    select: { summary: { select: { balance: true } } },
  });
  type Selected = Expect<
    Equal<
      (typeof result.rows)[number],
      { readonly summary: { readonly balance: number } | null }
    >
  >;
  const response: Backend.InferHandlerResponse<typeof read> = result;
  return response;
}
balances
  .map(({ balance }) => ({ label: balance.toFixed(2) }))
  .many(defineResource({ label: field.string() }));
balances
  .transformBatch((rows) =>
    rows.map(({ balance }) => ({ balance: balance * 2 })),
  )
  .many(Balance);

categorySource.related({
  // @ts-expect-error Unknown parent dependency.
  requires: ["missing"],
  output: schema.object({ balance: schema.number() }),
  resolveBatch: ({ parents }) => parents.map(({ ref }) => ({ ref, rows: [] })),
});
categorySource.related({
  requires: [],
  output: schema.object({ balance: schema.number() }),
  resolveBatch: ({ parents }) =>
    // @ts-expect-error Provider output must match its runtime schema.
    parents.map(({ ref }) => ({ ref, rows: [{ balance: "wrong" }] })),
});
categorySource.related({
  requires: [],
  output: schema.object({ balance: schema.number() }),
  // @ts-expect-error Every result needs its opaque parent reference.
  resolveBatch: () => [{ rows: [{ balance: 2 }] }],
});
// @ts-expect-error Public output type must match the inferred provider payload.
balances.one(defineResource({ balance: field.string() }));
// @ts-expect-error Custom loaders cannot append native stages.
balances.native({
  stages: [],
  output: schema.object({ balance: schema.number() }),
});
// @ts-expect-error A parent-scoped provider cannot be used as a root source.
defineRead(Balance, { source: balances });

// Providers compose inside existing relation scopes too.
const products = categorySource.related(productSource, {
  localField: "_id",
  foreignField: "category",
});
products
  .related({
    requires: ["stock"],
    output: schema.object({ balance: schema.number() }),
    resolveBatch: ({ parents }) =>
      parents.map(({ ref, row }) => ({ ref, rows: [{ balance: row.stock }] })),
  })
  .one(Balance);

// A provider payload can itself declare another custom relation.
balances.related({
  requires: ["balance"],
  output: schema.object({ label: schema.string() }),
  resolveBatch: ({ parents }) =>
    parents.map(({ ref, row }) => ({
      ref,
      rows: [{ label: String(row.balance) }],
    })),
});
