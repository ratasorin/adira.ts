/** Real MongoDB cases; lifecycle and per-test seed are supplied by read.test.ts. */
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose, { type PipelineStage } from "mongoose";
import {
  defineResource,
  field,
  ReadValidationError,
  schema,
} from "@n/adira.core.ts";
import { defineRead, mongo } from "../read";
import {
  Categories,
  Products,
  categorySource,
  productSource,
  ids,
} from "./fixtures";

const Stock = defineResource({
  stock: field.number().nullable().filterable("$gte"),
});
const Stats = defineResource({
  name: field.string().orderable(),
  count: field.number().filterable("$gte"),
  sum: field.number(),
  average: field.number().nullable(),
  minimum: field.number().nullable(),
  maximum: field.number().nullable(),
});
const full = {
  select: {
    name: true,
    count: true,
    sum: true,
    average: true,
    minimum: true,
    maximum: true,
  },
} as const;
function stockRelation(source = productSource) {
  return categorySource
    .related(source, { localField: "_id", foreignField: "category" })
    .many(Stock, { limits: { maxCandidates: 1 } });
}
function statsReader(products = stockRelation()) {
  const source = categorySource
    .load("count", products.count())
    .load("sum", products.sum({ field: "stock" }))
    .load("average", products.avg({ field: "stock" }))
    .load("minimum", products.min({ field: "stock" }))
    .load("maximum", products.max({ field: "stock" }));
  return defineRead(Stats, {
    source,
    scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
  });
}

test("five compatible reductions fuse into one validated native scan per parent batch", async () => {
  const products = stockRelation(),
    read = statsReader(products);
  const plan = read.inspect(full);
  assert.equal(plan.reductionGroups?.length, 1);
  assert.deepEqual(plan.reductionGroups![0].loads, [
    "count",
    "sum",
    "average",
    "minimum",
    "maximum",
  ]);
  assert.equal(plan.reductionGroups![0].phase, "output");
  assert.deepEqual(plan.dependencies.count.fusedWith, [
    "sum",
    "average",
    "minimum",
    "maximum",
  ]);
  const adapter = products.options.source.state.collection,
    scan = adapter.scan;
  const captured: PipelineStage[][] = [];
  adapter.scan = async function* (pipeline, size) {
    captured.push(pipeline);
    yield* scan.call(this, pipeline, size);
  };
  try {
    assert.deepEqual(await read(full), {
      rows: [
        {
          name: "Art",
          count: 0,
          sum: 0,
          average: null,
          minimum: null,
          maximum: null,
        },
        {
          name: "Games",
          count: 1,
          sum: 10,
          average: 10,
          minimum: 10,
          maximum: 10,
        },
        {
          name: "Books",
          count: 2,
          sum: 10,
          average: 5,
          minimum: 3,
          maximum: 7,
        },
        { name: "Audio", count: 1, sum: 0, average: 0, minimum: 0, maximum: 0 },
      ],
    });
    assert.equal(
      captured.length,
      2,
      "Two parent batches, rather than ten independent reduction scans",
    );
    for (const pipeline of captured) {
      assert.ok(!pipeline.some((stage) => "$lookup" in stage));
      const group = (pipeline[pipeline.length - 1] as PipelineStage.Group)
        .$group;
      assert.equal(
        Object.keys(group).filter((key) => key.includes("invalid")).length,
        1,
        "Shared validation is computed once",
      );
    }
    captured.length = 0;
    assert.equal(
      read.inspect({ select: { count: true } }).reductionGroups?.length,
      0,
    );
    await read({ select: { count: true } });
    assert.equal(captured.length, 2);
  } finally {
    adapter.scan = scan;
  }
});

test("fusion unions required native derivations and supports different numeric fields", async () => {
  const child = productSource.derive("twice", (e) =>
    e.multiply(e.field("stock"), e.literal(2)),
  );
  const resource = defineResource({
    stock: field.number(),
    twice: field.number(),
  });
  const products = categorySource
    .related(child, { localField: "_id", foreignField: "category" })
    .many(resource);
  const source = categorySource
    .load("count", products.count())
    .load("sum", products.sum({ field: "twice" }))
    .load("average", products.avg({ field: "stock" }))
    .load("minimum", products.min({ field: "twice" }))
    .load("maximum", products.max({ field: "stock" }));
  const read = defineRead(Stats, { source });
  assert.equal(read.inspect(full).reductionGroups?.length, 1);
  const result = await read(full);
  assert.deepEqual(
    result.rows.find((row) => row.name === "Books"),
    { name: "Books", count: 2, sum: 20, average: 5, minimum: 6, maximum: 7 },
  );
});

test("fused reductions retain null/missing semantics, finite-input validation and overflow checks", async () => {
  const inserted = await Products.collection.insertOne({
    category: ids.books,
    stock: null,
    name: "Nullable",
  } as never);
  const read = statsReader();
  const books = () =>
    read(full).then((result) =>
      result.rows.find((row) => row.name === "Books"),
    );
  assert.deepEqual(await books(), {
    name: "Books",
    count: 3,
    sum: 10,
    average: 5,
    minimum: 3,
    maximum: 7,
  });
  await Products.collection.updateOne(
    { _id: inserted.insertedId },
    { $unset: { stock: "" } },
  );
  assert.equal((await books())!.average, 5);
  for (const stock of [
    "wrong",
    [1],
    NaN,
    Infinity,
    mongoose.Types.Decimal128.fromString("3"),
    mongoose.mongo.Long.fromString("9007199254740992"),
  ]) {
    await Products.collection.updateOne({ _id: inserted.insertedId }, {
      $set: { stock },
    } as never);
    await assert.rejects(read(full), ReadValidationError);
    await read({ select: { count: true } }); // Unrequested numeric validation stays pruned.
  }
  await Products.collection.updateMany(
    { category: ids.books },
    { $set: { stock: Number.MAX_VALUE } },
  );
  await assert.rejects(read(full), ReadValidationError);
});

test("fusion preserves shared foreign arrays, deduplicates membership and handles empty collections", async () => {
  await Products.collection.insertOne({
    category: [ids.books, ids.games, ids.books],
    stock: 4,
    name: "Shared",
  } as never);
  const read = statsReader();
  const result = await read(full);
  assert.equal(result.rows.find((r) => r.name === "Books")!.count, 3);
  assert.equal(result.rows.find((r) => r.name === "Books")!.sum, 14);
  assert.equal(result.rows.find((r) => r.name === "Games")!.sum, 14);
  await Products.collection.deleteMany({});
  for (const row of (await read(full)).rows)
    assert.deepEqual(
      { ...row, name: undefined },
      {
        name: undefined,
        count: 0,
        sum: 0,
        average: null,
        minimum: null,
        maximum: null,
      },
    );
});

test("different filters, bindings and callbacks remain separate with inspection reasons", async () => {
  const products = stockRelation();
  const source = categorySource
    .load("count", products.count({ where: { stock: { $gte: 5 } } }))
    .load("sum", products.sum({ field: "stock" }));
  const resource = defineResource({
    name: field.string(),
    count: field.number(),
    sum: field.number(),
  });
  const read = defineRead(resource, { source });
  assert.equal(
    read.inspect({ select: { name: true, count: true, sum: true } })
      .reductionGroups?.length,
    0,
  );
  assert.match(
    read.inspect({ select: { name: true, count: true, sum: true } })
      .dependencies.sum.fusionReason!,
    /differ/,
  );
  assert.deepEqual(
    (await read({ select: { name: true, count: true, sum: true } })).rows.find(
      (r) => r.name === "Books",
    ),
    { name: "Books", count: 1, sum: 10 },
  );
  const otherBinding = stockRelation();
  const separate = categorySource
    .load("count", products.count())
    .load("sum", otherBinding.sum({ field: "stock" }));
  assert.equal(
    defineRead(resource, { source: separate }).inspect({
      select: { count: true, sum: true },
    }).reductionGroups?.length,
    0,
  );
  const changed = categorySource
    .load("count", products.count())
    .derive("_id", ["_id"], () => ids.games)
    .load("sum", products.sum({ field: "stock" }));
  const changedRead = defineRead(resource, { source: changed });
  assert.equal(
    changedRead.inspect({ select: { name: true, count: true, sum: true } })
      .reductionGroups?.length,
    0,
  );
  assert.deepEqual(
    (
      await changedRead({ select: { name: true, count: true, sum: true } })
    ).rows.find((r) => r.name === "Art"),
    { name: "Art", count: 0, sum: 10 },
  );
});

test("membership and display-only reductions stay on their respective sides of pagination", async () => {
  await Products.collection.updateMany({ category: ids.books }, {
    $set: { stock: "invalid" },
  } as never);
  const products = stockRelation();
  const source = categorySource
    .load("count", products.count())
    .load("average", products.avg({ field: "stock" }));
  const resource = defineResource({
    name: field.string().orderable(),
    count: field.number().filterable("$gte"),
    average: field.number().nullable(),
  });
  const read = defineRead(resource, { source });
  const query = {
    select: { name: true, count: true, average: true },
    where: { count: { $gte: 1 } },
    orderBy: { name: "asc" },
    page: { limit: 1 },
  } as const;
  const plan = read.inspect(query);
  assert.equal(plan.reductionGroups?.length, 0);
  assert.ok(
    plan.application.indexOf("load average") >
      plan.application.indexOf("paginate"),
  );
  assert.deepEqual(await read(query), {
    rows: [{ name: "Audio", count: 1, average: 0 }],
  });
});

test("fusion reuses captured policies and predicate factories without additional user-code invocation", async () => {
  let inputCalls = 0,
    scopeCalls = 0,
    predicateCalls = 0;
  const child = mongo.from(Products, {
    scope: (e) => {
      inputCalls++;
      return e.eq(e.field("isActive"), true);
    },
  });
  const Resource = defineResource(
    { stock: field.number() },
    { predicates: { allowed: field.boolean().filterable("$eq") } },
  );
  const products = categorySource
    .related(child, { localField: "_id", foreignField: "category" })
    .many(Resource, {
      scope: () => {
        scopeCalls++;
        return child.condition((e) => e.gte(e.field("stock"), 0));
      },
      filters: {
        allowed: {
          $eq: (expected) => {
            predicateCalls++;
            return child.condition((e) => e.eq(e.literal(true), expected));
          },
        },
      },
    });
  const source = categorySource
    .load("count", products.count({ where: { allowed: { $eq: true } } }))
    .load(
      "sum",
      products.sum({ field: "stock", where: { allowed: { $eq: true } } }),
    );
  const read = defineRead(
    defineResource({ count: field.number(), sum: field.number() }),
    { source },
  );
  await read({ select: { count: true, sum: true } });
  assert.deepEqual(
    { inputCalls, scopeCalls, predicateCalls },
    { inputCalls: 2, scopeCalls: 2, predicateCalls: 2 },
  );
});

test("different captured policy values prevent fusion even when the relation and query match", async () => {
  let calls = 0;
  const child = mongo
    .from(Products, {
      scope: (e) => e.eq(e.field("isActive"), ++calls % 2 === 1),
    })
    .derive("id", (e) => e.toString(e.field("_id")));
  const products = stockRelation(child);
  const source = categorySource
    .load("count", products.count())
    .load("sum", products.sum({ field: "stock" }));
  const read = defineRead(
    defineResource({ count: field.number(), sum: field.number() }),
    { source },
  );
  assert.equal(
    read.inspect({ select: { count: true, sum: true } }).reductionGroups
      ?.length,
    0,
  );
  assert.equal(calls, 2);
});
