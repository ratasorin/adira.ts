/** Loaded by read.test.ts to share its isolated MongoDB lifecycle and seed hooks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PipelineStage } from "mongoose";
import {
  defineResource,
  field,
  ReadValidationError,
  schema,
} from "@n/adira.core.ts";
import { defineRead, mongo } from "../read";
import { Categories, Products } from "./fixtures";
import {
  nativeStockSource,
  NativeStockResource,
  readNativeStocks,
} from "./native-producers.fixture";

const books = { name: { $eq: "Books" } } as const;
const Name = defineResource({ name: field.string().filterable("$eq") });
const hasLookup = (pipeline: readonly unknown[]) =>
  pipeline.some((stage) => "$lookup" in (stage as object));

test("native producers skip complete lookup blocks and their derived inputs when unused", async () => {
  const plan = readNativeStocks.inspect({ select: { name: true } });
  assert.equal(hasLookup(plan.pipeline), false);
  assert.equal(JSON.stringify(plan.pipeline).includes("stockJoinKey"), false);
  assert.deepEqual(
    await readNativeStocks({ select: { name: true }, where: books }),
    { rows: [{ name: "Books" }] },
  );
  const selected = {
    select: { name: true, stockTotal: true, productCount: true },
    where: books,
  } as const;
  const selectedPlan = readNativeStocks.inspect(selected);
  assert.equal(
    selectedPlan.pipeline.filter((stage) => "$lookup" in (stage as object))
      .length,
    1,
  );
  assert.deepEqual(await readNativeStocks(selected), {
    rows: [{ name: "Books", stockTotal: 10, productCount: 2 }],
  });
  assert.equal(
    hasLookup(readNativeStocks.inspect({ select: { name: true } }).pipeline),
    false,
  );
});

test("native producers activate for unselected filter, Boolean, ordering and scope dependencies", async () => {
  const queries = [
    { select: { name: true }, where: { stockTotal: { $gte: 1 } } },
    { select: { name: true }, where: { $not: { stockTotal: { $gte: 1 } } } },
    {
      select: { name: true },
      where: { $or: [{ stockTotal: { $gte: 1 } }, { name: { $eq: "Games" } }] },
    },
    {
      select: { name: true },
      orderBy: { stockTotal: "desc" },
      page: { limit: 1 },
    },
  ] as const;
  for (const query of queries)
    assert.equal(hasLookup(readNativeStocks.inspect(query).pipeline), true);
  assert.deepEqual(await readNativeStocks(queries[0]), {
    rows: [{ name: "Books" }],
  });
  assert.deepEqual(await readNativeStocks(queries[1]), {
    rows: [{ name: "Art" }, { name: "Audio" }, { name: "Games" }],
  });
  assert.deepEqual(await readNativeStocks(queries[2]), {
    rows: [{ name: "Books" }, { name: "Games" }],
  });
  assert.deepEqual(await readNativeStocks(queries[3]), {
    rows: [{ name: "Books" }],
  });
  const scoped = defineRead(NativeStockResource, {
    source: nativeStockSource,
    scope: () =>
      nativeStockSource.condition((e) => e.gt(e.field("stockTotal"), 0)),
  });
  assert.deepEqual(await scoped({ select: { name: true } }), {
    rows: [{ name: "Books" }],
  });
});

test("native producers preserve empty parents and keep filtering local to the lookup", async () => {
  assert.deepEqual(
    await readNativeStocks({ select: { name: true, stockTotal: true } }),
    {
      rows: [
        { name: "Art", stockTotal: 0 },
        { name: "Audio", stockTotal: 0 },
        { name: "Books", stockTotal: 10 },
        { name: "Games", stockTotal: 0 },
      ],
    },
  );
});

test("native producer dependencies compose through native and application computations", async () => {
  const native = nativeStockSource.native({
    provides: ["doubled"],
    requires: ["stockTotal"],
    stages: [{ $set: { doubled: { $multiply: ["$stockTotal", 2] } } }],
    output: schema.object({ doubled: schema.number() }),
  });
  const source = native
    .toApp()
    .derive("label", ["doubled"], ({ doubled }) => `Stock ${doubled}`);
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      label: field.string(),
    }),
    { source },
  );
  assert.equal(
    hasLookup(read.inspect({ select: { label: true } }).pipeline),
    true,
  );
  assert.equal(
    hasLookup(read.inspect({ select: { name: true } }).pipeline),
    false,
  );
  assert.deepEqual(await read({ select: { label: true }, where: books }), {
    rows: [{ label: "Stock 20" }],
  });
});

test("producer blocks are atomic, preserve field versions, and survive native projections", async () => {
  const source = nativeStockSource
    .native({
      provides: ["stockTotal"],
      requires: ["stockTotal"],
      stages: [{ $set: { stockTotal: { $add: ["$stockTotal", 1] } } }],
      output: schema.object({ stockTotal: schema.number() }),
    })
    .project(["name", "stockTotal", "productCount"]);
  const read = defineRead(NativeStockResource, { source });
  assert.deepEqual(
    await read({
      select: { stockTotal: true, productCount: true },
      where: books,
    }),
    { rows: [{ stockTotal: 11, productCount: 2 }] },
  );
  const overwritten = nativeStockSource
    .toApp()
    .derive("stockTotal", [], () => 99);
  const changed = defineRead(NativeStockResource, { source: overwritten });
  assert.equal(
    hasLookup(changed.inspect({ select: { stockTotal: true } }).pipeline),
    false,
  );
  assert.deepEqual(
    await changed({ select: { stockTotal: true }, where: books }),
    { rows: [{ stockTotal: 99 }] },
  );
  // The shared producer remains needed when its other output is requested.
  assert.deepEqual(
    await changed({
      select: { stockTotal: true, productCount: true },
      where: books,
    }),
    { rows: [{ stockTotal: 99, productCount: 2 }] },
  );
});

test("producer output validation runs when activated, including sibling outputs", async () => {
  const source = mongo.from(Categories).native({
    provides: ["total", "count"],
    requires: [],
    stages: [{ $set: { total: 10, count: "invalid" } }],
    output: schema.object({ total: schema.number(), count: schema.number() }),
  });
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      total: field.number(),
    }),
    { source },
  );
  assert.deepEqual(await read({ select: { name: true }, where: books }), {
    rows: [{ name: "Books" }],
  });
  await assert.rejects(
    read({ select: { total: true }, where: books }),
    ReadValidationError,
  );
  const empty = mongo.from(Categories).native({
    provides: ["missing"],
    requires: [],
    stages: [],
    output: schema.object({ missing: schema.number() }),
  });
  const missing = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      missing: field.number(),
    }),
    { source: empty },
  );
  await missing({ select: { name: true }, where: books });
  await assert.rejects(
    missing({ select: { missing: true }, where: books }),
    ReadValidationError,
  );
});

test("native producers work inside direct/deferred relations and native aggregate dependencies", async () => {
  for (const deferred of [false, true]) {
    const native = mongo.from(Categories);
    const parent = deferred
      ? native.toApp().filter(() => true)
      : native.toApp();
    const products = parent
      .related(mongo.from(Products), {
        localField: "_id",
        foreignField: "category",
      })
      .native({
        provides: ["score"],
        requires: ["stock"],
        stages: [{ $set: { score: { $multiply: ["$stock", 2] } } }],
        output: schema.object({ score: schema.number() }),
      });
    const Item = defineResource({
      name: field.string(),
      score: field.number(),
    });
    const binding = products.many(Item);
    const source = parent.load("total", binding.sum({ field: "score" }));
    const read = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        total: field.number(),
        products: field.many(Item),
      }),
      { source, relations: { products: binding } },
    );
    const query = {
      select: { total: true, products: { select: { score: true } } },
      where: books,
    } as const;
    assert.equal(read.inspect(query).dependencies.total.strategy, "mongodb");
    const result = await read(query);
    assert.equal(result.rows[0].total, 20);
    assert.deepEqual(
      result.rows[0].products.map(({ score }) => score).sort((a, b) => a - b),
      [6, 14],
    );
    const names = await read({
      select: { products: { select: { name: true } } },
      where: books,
    });
    assert.deepEqual(names.rows[0].products.map(({ name }) => name).sort(), [
      "Book A",
      "Book B",
    ]);
  }
});

test("producer outputs can supply relation keys without discarding existing source identity", async () => {
  const source = mongo.from(Categories).native({
    provides: ["joinKey"],
    requires: ["_id"],
    stages: [{ $set: { joinKey: "$_id" } }],
    output: schema.object({
      joinKey: schema.custom<unknown>((value) => value),
    }),
  });
  const child = source
    .related(mongo.from(Products), {
      localField: "_id",
      foreignField: "category",
    })
    .many(Name);
  const custom = source.related({
    requires: ["joinKey"],
    output: schema.object({ value: schema.string() }),
    resolveBatch: ({ parents }) =>
      parents.map(({ ref, row }) => ({
        ref,
        rows: [{ value: String(row.joinKey) }],
      })),
  });
  const Value = defineResource({ value: field.string() });
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      products: field.many(Name),
      value: field.one(Value),
    }),
    { source, relations: { products: child, value: custom.one(Value) } },
  );
  const result = await read({
    select: {
      products: { select: { name: true } },
      value: { select: { value: true } },
    },
    where: books,
  });
  assert.equal(result.rows[0].products.length, 2);
  assert.match(result.rows[0].value.value, /^[a-f\d]{24}$/);
});

test("native producer declarations fail before execution when inconsistent or writable", () => {
  const source = mongo.from(Categories);
  // Exercise runtime guards for untyped JavaScript/unsafe casts as well as TS checks.
  const register = source.native.bind(source) as (options: object) => unknown;
  const defaults = {
    provides: ["score"],
    requires: ["_id"],
    stages: [],
    output: schema.object({ score: schema.number() }),
  };
  for (const override of [
    { provides: [] },
    { provides: ["score", "score"] },
    { provides: ["other"] },
    { provides: ["score", "other"] },
    { requires: ["missing"] },
    { requires: undefined },
    { provides: undefined },
    { preserves: ["_id"] },
  ])
    assert.throws(
      () => register({ ...defaults, ...override }),
      /producer|produces|provides|requires/i,
    );
  assert.throws(
    () =>
      register({
        ...defaults,
        stages: [
          {
            $lookup: {
              from: "products",
              pipeline: [{ $out: "other" }],
              as: "score",
            },
          },
        ],
      }),
    /cannot contain \$out or \$merge/i,
  );
});

test("reused stage objects retain independent producer identities", async () => {
  const stages: PipelineStage[] = [
    { $set: { score: { $add: ["$subtotal", 1] } } },
  ];
  const first = mongo.from(Categories).native({
    provides: ["score"],
    requires: ["subtotal"],
    stages,
    output: schema.object({ score: schema.number() }),
  });
  const source = first
    .derive("subtotal", (e) => e.field("score"))
    .native({
      provides: ["score"],
      requires: ["subtotal"],
      stages,
      output: schema.object({ score: schema.number() }),
    });
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      score: field.number(),
    }),
    { source },
  );
  assert.deepEqual(await read({ select: { score: true }, where: books }), {
    rows: [{ score: 32 }],
  });
});

test("producer metadata does not prove row preservation: shape-valid filtering can still drop parents", async () => {
  // A regression documenting the enforcement boundary, not a supported field producer.
  const source = mongo.from(Categories).native({
    provides: ["score"],
    requires: ["name"],
    stages: [{ $match: { name: "Books" } }, { $set: { score: 1 } }],
    output: schema.object({ score: schema.number() }),
  });
  const read = defineRead(
    defineResource({ name: field.string(), score: field.number() }),
    { source },
  );
  assert.equal((await read({ select: { name: true } })).rows.length, 5);
  assert.deepEqual(await read({ select: { name: true, score: true } }), {
    rows: [{ name: "Books", score: 1 }],
  });
});
