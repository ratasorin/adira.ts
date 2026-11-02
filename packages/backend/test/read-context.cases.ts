/** Loaded by read.test.ts to share its temporary MongoDB lifecycle. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defineResource,
  field,
  schema,
  ReadValidationError,
} from "@n/adira.core.ts";
import { createReadContext, defineRead, mongo } from "../read";
import { Categories, Products } from "./fixtures";

type Context = {
  tenant: string;
  factor: number;
  inventory: { value(amount: number): Promise<number> };
};
const Name = field.string().filterable("$in").orderable();
const where = { name: { $in: ["Books", "Games"] } } as const;

test("typed context reaches source/reader/relation scopes, transformations, predicates, loaders and dependencies unchanged", async () => {
  const context: Context = {
    tenant: "demo",
    factor: 2,
    inventory: { value: async (amount) => amount * 2 },
  };
  const seen = new Set<string>();
  function check(label: string, current: Context) {
    assert.equal(current, context);
    seen.add(label);
  }
  const backend = createReadContext<Context>();
  const source = backend.mongo
    .from(Categories, {
      scope: (e, ctx) => {
        check("source scope", ctx);
        return e.eq(e.field("tenant"), ctx.tenant);
      },
    })
    .toApp({ batchSize: 2 })
    .derive("label", ["name"], (row, ctx) => {
      check("derive", ctx);
      return ctx.tenant + ":" + row.name;
    })
    .map((row, ctx) => {
      check("map", ctx);
      return { ...row };
    })
    .filter((_, ctx) => {
      check("filter", ctx);
      return true;
    })
    .transformBatch((rows, ctx) => {
      check("batch", ctx);
      return rows;
    });
  const Stock = defineResource({ stock: field.number() });
  const summaries = source
    .related({
      requires: ["subtotal"],
      output: schema.object({ stock: schema.number() }),
      resolveBatch: async ({ parents, context: ctx }) => {
        check("resolveBatch", ctx);
        return Promise.all(
          parents.map(async ({ ref, row }) => ({
            ref,
            rows: [{ stock: await ctx.inventory.value(row.subtotal) }],
          })),
        );
      },
    })
    .derive("stock", ["stock"], (row, ctx) => {
      check("relation derive", ctx);
      return row.stock + ctx.factor;
    })
    .map((row, ctx) => {
      check("relation map", ctx);
      return row;
    })
    .filter((_, ctx) => {
      check("relation filter", ctx);
      return true;
    })
    .transformBatch((rows, ctx) => {
      check("relation batch", ctx);
      return rows;
    });
  const summary = summaries.one(Stock, {
    scope: (ctx) => {
      check("relation scope", ctx);
      return summaries.appCondition({
        requires: ["stock"],
        evaluate: (row, current) => {
          check("relation predicate", current);
          return row.stock >= current.factor;
        },
      });
    },
  });
  const loaded = source
    .load("summaryValue", summary.get({ select: { stock: true } }))
    .derive("total", ["summaryValue"], (row, ctx) => {
      check("dependency derive", ctx);
      return row.summaryValue?.stock ?? 0;
    });
  const resource = defineResource(
    {
      name: Name,
      label: field.string(),
      total: field.number(),
      summary: field.one(Stock),
    },
    {
      predicates: { visible: field.boolean().filterable("$eq") },
    },
  );
  const read = backend.defineRead(resource, {
    source: loaded,
    relations: { summary },
    scope: (ctx) => {
      check("reader scope", ctx);
      return loaded.appCondition({
        requires: ["tenant"],
        evaluate: (row, current) => {
          check("reader predicate", current);
          return row.tenant === current.tenant;
        },
      });
    },
    filters: {
      visible: {
        $eq: (expected) =>
          loaded.appCondition({
            requires: [],
            evaluate: (_, ctx) => {
              check("custom filter", ctx);
              return ctx.factor > 0 === expected;
            },
          }),
      },
    },
  });
  assert.deepEqual(
    await read(
      {
        select: {
          name: true,
          label: true,
          total: true,
          summary: { select: { stock: true } },
        },
        where: { ...where, visible: { $eq: true } },
        orderBy: { name: "asc" },
      },
      context,
    ),
    {
      rows: [
        {
          name: "Books",
          label: "demo:Books",
          total: 62,
          summary: { stock: 62 },
        },
        {
          name: "Games",
          label: "demo:Games",
          total: 42,
          summary: { stock: 42 },
        },
      ],
    },
  );
  assert.deepEqual(
    [...seen].sort(),
    [
      "source scope",
      "derive",
      "map",
      "filter",
      "batch",
      "resolveBatch",
      "relation derive",
      "relation map",
      "relation filter",
      "relation batch",
      "relation scope",
      "relation predicate",
      "dependency derive",
      "reader scope",
      "reader predicate",
      "custom filter",
    ].sort(),
  );
});

test("native and deferred relations reuse context-independent plans and plans with smaller context requirements", async () => {
  const context = { tenant: "demo", factor: 5 };
  const backend = createReadContext<typeof context>();
  const childBackend = createReadContext<{ factor: number }>();
  const parent = backend.mongo.from(Categories, {
    scope: (e, ctx) => e.eq(e.field("tenant"), ctx.tenant),
  });
  const child = childBackend.mongo.from(Products, {
    scope: (e, ctx) => {
      assert.equal(ctx, context);
      return e.gte(e.field("stock"), ctx.factor);
    },
  });
  const Product = defineResource({ name: field.string() });
  for (const deferred of [false, true]) {
    const source = deferred ? parent.toApp().filter(() => true) : parent;
    const products = source.related(child, {
      localField: "_id",
      foreignField: "category",
    });
    const independent = source.related(
      mongo
        .from(Products)
        .toApp()
        .derive("label", ["name"], (row) => row.name),
      { localField: "_id", foreignField: "category" },
    );
    const read = backend.defineRead(
      defineResource({
        name: Name,
        products: field.many(Product),
        allProducts: field.many(Product),
      }),
      {
        source,
        relations: {
          products: products.many(Product),
          allProducts: independent.many(Product),
        },
      },
    );
    const query = {
      select: {
        name: true,
        products: { select: { name: true } },
        allProducts: { select: { name: true } },
      },
      where,
      orderBy: { name: "asc" },
    } as const;
    assert.deepEqual(await read(query, context), {
      rows: [
        {
          name: "Books",
          products: [{ name: "Book B" }],
          allProducts: [{ name: "Book A" }, { name: "Book B" }],
        },
        {
          name: "Games",
          products: [{ name: "Game" }],
          allProducts: [{ name: "Game" }],
        },
      ],
    });
  }
});

test("typed readers reject missing context at runtime before source access, including inspect and reused sources", async () => {
  const backend = createReadContext<{ tenant: string }>();
  const Resource = defineResource({ name: Name });
  const source = backend.mongo.from(Categories, {
    scope: (e, ctx) => e.eq(e.field("tenant"), ctx.tenant),
  });
  const read = backend.defineRead(Resource, { source });
  const inferred = defineRead(Resource, { source });
  const reused = backend.defineRead(Resource, {
    source: mongo.from(Categories),
  });
  const query = { select: { name: true } } as const;
  for (const execute of [read, inferred, reused]) {
    // @ts-expect-error Deliberately bypass the typed call contract to test JS callers.
    await assert.rejects(execute(query), ReadValidationError);
    // @ts-expect-error Deliberately omit required context for inspection.
    assert.throws(() => execute.inspect(query), ReadValidationError);
    // @ts-expect-error Null is also invalid context.
    await assert.rejects(execute(query, null), ReadValidationError);
  }
});

test("concurrent requests keep their typed contexts isolated and pass context through inspection", async () => {
  const backend = createReadContext<{ tenant: string; factor: number }>();
  const source = backend.mongo
    .from(Categories, {
      scope: (e, ctx) => e.eq(e.field("tenant"), ctx.tenant),
    })
    .toApp()
    .derive("value", ["subtotal"], async (row, ctx) => {
      await Promise.resolve();
      return row.subtotal * ctx.factor;
    });
  const read = backend.defineRead(
    defineResource({ name: Name, value: field.number() }),
    { source },
  );
  const query = {
    select: { name: true, value: true },
    orderBy: { name: "asc" },
  } as const;
  const first = { tenant: "demo", factor: 2 },
    second = { tenant: "other", factor: 3 };
  assert.deepEqual(read.inspect(query, first).pipeline[0], {
    $match: {
      tenant: { $eq: "demo" },
      $expr: { $eq: [{ $ifNull: ["$tenant", null] }, { $literal: "demo" }] },
    },
  });
  const results = await Promise.all([read(query, first), read(query, second)]);
  assert.deepEqual(results[0], {
    rows: [
      { name: "Art", value: 20 },
      { name: "Audio", value: 80 },
      { name: "Books", value: 60 },
      { name: "Games", value: 40 },
    ],
  });
  assert.deepEqual(results[1], { rows: [{ name: "Alien", value: 300 }] });
});
