import {
  Backend,
  defineResource,
  field,
  schema,
  type ReadExecutor,
} from "@n/adira.core.ts";
import {
  createReadContext,
  defineRead,
  mongo,
  type PlanContext,
  type PlanRow,
} from "../read";
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
type Context = {
  tenant: string;
  factor: number;
  inventory: { stock(id: string): Promise<number> };
};
declare const context: Context;
const backend = createReadContext<Context>();
const source = backend.mongo.from(Categories, {
  scope: (e, ctx) => {
    type Input = Expect<Equal<typeof ctx, Context>>;
    // @ts-expect-error Unknown context fields are rejected.
    ctx.missing;
    return e.eq(e.field("tenant"), ctx.tenant);
  },
});
type NativeContext = Expect<Equal<PlanContext<typeof source>, Context>>;
const native = source
  .derive("double", (e) => e.multiply(e.field("subtotal"), e.literal(2)))
  .project(["_id", "name", "tenant", "double"])
  .native({
    stages: [],
    output: schema.object({ name: schema.string(), tenant: schema.string() }),
  });
type NativeAfterChanges = Expect<Equal<PlanContext<typeof native>, Context>>;
const app = source
  .toApp()
  .derive("scaled", ["subtotal"], (row, ctx) => {
    type Derived = Expect<Equal<typeof ctx, Context>>;
    return row.subtotal * ctx.factor;
  })
  .map((row, ctx) => {
    type Mapped = Expect<Equal<typeof ctx, Context>>;
    return { ...row, label: ctx.tenant + row.name };
  })
  .filter((row, ctx) => {
    type Filtered = Expect<Equal<typeof ctx, Context>>;
    return row.tenant === ctx.tenant;
  })
  .transformBatch((rows, ctx) => {
    type Batched = Expect<Equal<typeof ctx, Context>>;
    return rows.map((row) => ({ ...row, value: row.scaled * ctx.factor }));
  })
  .use((plan) => {
    type Fragment = Expect<Equal<PlanContext<typeof plan>, Context>>;
    return plan;
  });
type AppContext = Expect<Equal<PlanContext<typeof app>, Context>>;
type Value = Expect<Equal<PlanRow<typeof app>["value"], number>>;
const condition = app.appCondition({
  requires: ["value"],
  evaluate: (row, ctx) => {
    type Predicate = Expect<Equal<typeof ctx, Context>>;
    return row.value >= ctx.factor;
  },
});

const Stock = defineResource({
  stock: field.number().filterable("$gte").orderable(),
});
const stocks = app
  .related({
    requires: ["_id"],
    output: schema.object({ stock: schema.number() }),
    resolveBatch: async ({ parents, context: ctx }) => {
      type Loader = Expect<Equal<typeof ctx, Context>>;
      return Promise.all(
        parents.map(async ({ ref, row }) => ({
          ref,
          rows: [{ stock: await ctx.inventory.stock(String(row._id)) }],
        })),
      );
    },
  })
  .derive("stock", ["stock"], (row, ctx) => row.stock * ctx.factor)
  .map((row, ctx) => ({ stock: row.stock + ctx.factor }))
  .filter((row, ctx) => row.stock > ctx.factor)
  .transformBatch((rows, ctx) => rows.filter((row) => row.stock >= ctx.factor));
type RelationContext = Expect<Equal<PlanContext<typeof stocks>, Context>>;
const stockBinding = stocks.one(Stock, {
  scope: (ctx) => {
    type Scope = Expect<Equal<typeof ctx, Context>>;
    return stocks.appCondition({
      requires: ["stock"],
      evaluate: (row, current) => row.stock >= current.factor,
    });
  },
});
const loaded = app.load(
  "summary",
  stockBinding.get({ select: { stock: true } }),
);
type LoadedContext = Expect<Equal<PlanContext<typeof loaded>, Context>>;
const Resource = defineResource(
  { name: field.string(), summary: field.one(Stock) },
  {
    predicates: { visible: field.boolean().filterable("$eq") },
  },
);
const reader = backend.defineRead(Resource, {
  source: loaded,
  relations: { summary: stockBinding },
  scope: (ctx) => {
    type ReaderScope = Expect<Equal<typeof ctx, Context>>;
    return loaded.appCondition({
      requires: ["tenant"],
      evaluate: (row, current) => row.tenant === current.tenant,
    });
  },
  filters: {
    visible: {
      $eq: (expected) =>
        loaded.appCondition({
          requires: ["tenant"],
          evaluate: (row, ctx) => (row.tenant === ctx.tenant) === expected,
        }),
    },
  },
});
const query = {
  select: { name: true, summary: { select: { stock: true } } },
} as const;
reader(query, context);
reader.inspect(query, context);
// @ts-expect-error Context is required for execution.
reader(query);
// @ts-expect-error Context is required for inspection too.
reader.inspect(query);
// @ts-expect-error Context cannot be undefined.
reader(query, undefined);
// @ts-expect-error Context cannot be null.
reader(query, null);
// @ts-expect-error Context services and fields must be present.
reader(query, { tenant: "demo" });
// @ts-expect-error Context field types are checked.
reader(query, { ...context, factor: "2" });
async function response() {
  const result = await reader(query, context);
  type Selected = Expect<
    Equal<
      (typeof result.rows)[number],
      { readonly name: string; readonly summary: { readonly stock: number } }
    >
  >;
  const envelope: Backend.InferHandlerResponse<typeof reader> = result;
  return envelope;
}

// Standalone defineRead also infers the source context; it cannot infer a weaker
// context from a callback or relation supplied later in the options object.
const inferred = defineRead(defineResource({ name: field.string() }), {
  source,
});
inferred({ select: { name: true } }, context);
// @ts-expect-error Inference preserves required context.
inferred({ select: { name: true } });

// Context-independent sources remain usable in typed readers and relations.
const independent = mongo.from(Products);
source.related(independent, { localField: "_id", foreignField: "category" });
source.related(
  independent.toApp().derive("label", ["name"], (row) => row.name),
  { localField: "_id", foreignField: "category" },
);
const reused = backend.defineRead(defineResource({ name: field.string() }), {
  source: categorySource,
});
reused({ select: { name: true } }, context);
// @ts-expect-error The typed factory requires its context even for a reused source.
reused({ select: { name: true } });

const other = createReadContext<{ token: string }>();
const otherSource = other.mongo.from(Products);
// @ts-expect-error Child context requirements are incompatible.
source.related(otherSource, { localField: "_id", foreignField: "category" });
// @ts-expect-error Legacy parent cannot supply a required child context.
categorySource.related(otherSource, {
  localField: "_id",
  foreignField: "category",
});
backend.defineRead(defineResource({ name: field.string() }), {
  // @ts-expect-error Factory cannot bind a source requiring a different context.
  source: other.mongo.from(Categories),
});
const richer = createReadContext<Context & { secret: string }>();
// @ts-expect-error Context cannot silently gain additional requirements.
source.related(richer.mongo.from(Products), {
  localField: "_id",
  foreignField: "category",
});
// A richer application context can satisfy a child's smaller requirement.
richer.mongo
  .from(Categories)
  .related(source, { localField: "_id", foreignField: "_id" })
  .toApp()
  .derive("secret", [], (_, ctx) => ctx.secret);
// Existing bindings can also run with a richer reader context.
richer.defineRead(Resource, {
  source: loaded,
  relations: { summary: stockBinding },
  filters: { visible: { $eq: () => condition } },
});
const otherSummary = other.mongo
  .from(Categories)
  .related({
    requires: [],
    output: schema.object({ stock: schema.number() }),
    resolveBatch: ({ parents, context }) =>
      parents.map(({ ref }) => ({
        ref,
        rows: [{ stock: context.token.length }],
      })),
  })
  .one(Stock);
// @ts-expect-error Loaded dependencies cannot introduce an incompatible context.
source.toApp().load("other", otherSummary.get({ select: { stock: true } }));
// @ts-expect-error Builder fragments must retain a compatible context.
source.use(() => other.mongo.from(Categories));
backend.defineRead(defineResource({ summary: field.one(Stock) }), {
  source,
  // @ts-expect-error Public relation bindings cannot introduce an incompatible context.
  relations: { summary: otherSummary },
});
const otherCondition = other.mongo
  .from(Categories)
  .appCondition({ requires: [], evaluate: (_, ctx) => !!ctx.token });
backend.defineRead(defineResource({ name: field.string() }), {
  source,
  // @ts-expect-error Predicate context must be compatible with the reader.
  scope: () => otherCondition,
});
defineRead(defineResource({ name: field.string() }), {
  source,
  // @ts-expect-error Inferred reader cannot narrow its context to accommodate an incompatible predicate.
  scope: () => otherCondition,
});

// Existing unknown-context readers remain source-compatible.
const legacy = defineRead(defineResource({ name: field.string() }), {
  source: categorySource,
});
legacy({ select: { name: true } });
legacy({ select: { name: true } }, { arbitrary: true });
legacy.inspect({ select: { name: true } });
declare const publicExecutor: ReadExecutor<typeof Stock>;
publicExecutor({ select: { stock: true } });
