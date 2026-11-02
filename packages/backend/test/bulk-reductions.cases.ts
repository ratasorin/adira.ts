/** Loaded by read.test.ts with its private MongoDB lifecycle and seed hooks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose, { type PipelineStage } from "mongoose";
import {
  defineResource,
  field,
  schema,
  ReadValidationError,
} from "@n/adira.core.ts";
import {
  defineRead,
  mongo,
  MongoExpression,
  type RelationBinding,
} from "../read";
import {
  Categories,
  Products,
  categorySource,
  productSource,
  ids,
} from "./fixtures";

const Numeric = defineResource({
  stock: field.number().filterable("$gte", "$lt"),
});
const query = { select: { name: true, count: true, sum: true } } as const;
function totals(
  products: RelationBinding<typeof categorySource.__row, typeof Numeric, true>,
) {
  const source = categorySource
    .load("count", products.count())
    .load("sum", products.sum({ field: "stock" }));
  return defineRead(
    defineResource({
      name: field.string(),
      count: field.number(),
      sum: field.number(),
    }),
    {
      source,
      scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
    },
  );
}

test("bulk reductions retain original correlation through overwritten keys and projections", async () => {
  const child = mongo.from(Products, {
    scope: (e) => e.eq(e.field("isActive"), true),
  });
  const products = categorySource
    .related(child, { localField: "_id", foreignField: "category" })
    .derive("category", (e) => e.literal(ids.hidden))
    .where((e) => e.eq(e.field("category"), ids.hidden))
    .derive("stock", (e) => e.multiply(e.field("stock"), e.literal(2)))
    .where((e) => e.gt(e.field("stock"), 0))
    .project(["stock"])
    .many(Numeric);
  const read = totals(products);
  assert.equal(read.inspect(query).dependencies.sum.execution, "bulk");
  assert.ok(
    read
      .inspect(query)
      .dependencies.sum.child.pipeline.some(
        (stage) => "category" in ((stage as { $set?: object }).$set ?? {}),
      ),
    "the join-field overwrite must execute rather than be pruned",
  );
  assert.deepEqual(await read(query), {
    rows: [
      { name: "Art", count: 0, sum: 0 },
      { name: "Games", count: 0, sum: 0 },
      { name: "Books", count: 2, sum: 20 },
      { name: "Audio", count: 0, sum: 0 },
    ],
  });
});

test("bulk reductions share duplicate parent keys and skip null/missing parents", async () => {
  await Categories.collection.updateOne(
    { _id: ids.games },
    { $set: { createdBy: ids.ana } },
  );
  await Categories.collection.updateOne(
    { _id: ids.books },
    { $set: { createdBy: null } },
  );
  await Categories.collection.updateOne(
    { _id: ids.audio },
    { $unset: { createdBy: "" } },
  );
  await Products.collection.insertOne({
    category: ids.ana,
    name: "Shared",
    stock: 4,
    isActive: true,
  });
  const products = categorySource
    .related(productSource, {
      localField: "createdBy",
      foreignField: "category",
    })
    .many(Numeric);
  const read = totals(products);
  const adapter = products.options.source.state.collection;
  const scan = adapter.scan;
  const batches: number[] = [];
  adapter.scan = async function* (pipeline, size) {
    const keys = (pipeline[0] as { $match: { category: { $in: unknown[] } } })
      .$match.category.$in;
    batches.push(keys.length);
    yield* scan.call(this, pipeline, size);
  };
  try {
    assert.deepEqual(await read(query), {
      rows: [
        { name: "Art", count: 1, sum: 4 },
        { name: "Games", count: 1, sum: 4 },
        { name: "Books", count: 0, sum: 0 },
        { name: "Audio", count: 0, sum: 0 },
      ],
    });
    assert.deepEqual(
      batches,
      [1],
      "compatible reductions share one key query; empty batches do not query",
    );
  } finally {
    adapter.scan = scan;
  }
});

test("bulk reductions handle array-valued foreign BSON even when the model declares a scalar", async () => {
  await Products.collection.insertOne({
    category: [ids.books, ids.games, ids.books, null, "unrelated"],
    name: "Shared",
    stock: 3,
    isActive: true,
  } as never);
  const products = categorySource
    .related(productSource, { localField: "_id", foreignField: "category" })
    .many(Numeric);
  assert.deepEqual(await totals(products)(query), {
    rows: [
      { name: "Art", count: 0, sum: 0 },
      { name: "Games", count: 2, sum: 13 },
      { name: "Books", count: 3, sum: 13 },
      { name: "Audio", count: 1, sum: 0 },
    ],
  });
});

test("bulk reductions preserve complete Boolean filters before aggregating", async () => {
  const products = categorySource
    .related(productSource, { localField: "_id", foreignField: "category" })
    .many(Numeric);
  const where = {
    $or: [{ stock: { $gte: 7 } }, { $not: { stock: { $gte: 1 } } }],
  } as const;
  const source = categorySource
    .load("count", products.count({ where }))
    .load("sum", products.sum({ field: "stock", where }));
  const read = defineRead(
    defineResource({
      name: field.string(),
      count: field.number(),
      sum: field.number(),
    }),
    {
      source,
      scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
    },
  );
  assert.equal(read.inspect(query).dependencies.count.execution, "bulk");
  assert.deepEqual(await read(query), {
    rows: [
      { name: "Art", count: 0, sum: 0 },
      { name: "Games", count: 1, sum: 10 },
      { name: "Books", count: 1, sum: 7 },
      { name: "Audio", count: 1, sum: 0 },
    ],
  });
});

test("limits, grouping and empty-input facets retain independent native execution per parent", async () => {
  const cases: {
    stages: PipelineStage[];
    books: number;
    emptyCount: number;
  }[] = [
    {
      stages: [
        { $sort: { stock: -1 } },
        { $limit: 1 },
        { $project: { stock: 1 } },
      ],
      books: 7,
      emptyCount: 0,
    },
    {
      stages: [{ $group: { _id: null, stock: { $sum: "$stock" } } }],
      books: 10,
      emptyCount: 0,
    },
    {
      stages: [
        {
          $facet: {
            values: [{ $group: { _id: null, stock: { $sum: "$stock" } } }],
          },
        },
        {
          $project: {
            stock: { $ifNull: [{ $arrayElemAt: ["$values.stock", 0] }, 0] },
          },
        },
      ],
      books: 10,
      emptyCount: 1,
    },
  ];
  for (const { stages, books, emptyCount } of cases) {
    const products = categorySource
      .related(productSource, { localField: "_id", foreignField: "category" })
      .native({ stages, output: schema.object({ stock: schema.number() }) })
      .many(Numeric);
    const read = totals(products);
    const plan = read.inspect(query);
    assert.equal(plan.dependencies.sum.execution, "parent-scoped");
    assert.match(plan.dependencies.sum.reason!, /Opaque native/);
    assert.deepEqual(await read(query), {
      rows: [
        { name: "Art", count: emptyCount, sum: 0 },
        { name: "Games", count: 1, sum: 10 },
        { name: "Books", count: 1, sum: books },
        { name: "Audio", count: 1, sum: 0 },
      ],
    });
  }
});

test("non-ObjectId and multikey parent batches retain their native join semantics", async () => {
  await Categories.collection.updateOne({ _id: ids.art }, {
    $set: { createdBy: [ids.books, ids.games, ids.books] },
  } as never);
  await Categories.collection.updateOne({ _id: ids.games }, {
    $set: { createdBy: "shared" },
  } as never);
  await Categories.collection.updateOne(
    { _id: ids.books },
    { $set: { createdBy: null } },
  );
  await Categories.collection.updateOne(
    { _id: ids.audio },
    { $set: { createdBy: null } },
  );
  await Products.collection.insertOne({
    category: "shared",
    name: "String",
    stock: 11,
  } as never);
  const products = categorySource
    .related(productSource, {
      localField: "createdBy",
      foreignField: "category",
    })
    .many(Numeric);
  const read = totals(products);
  const adapter = products.options.source.state.collection;
  const scan = adapter.scan;
  let fallback = 0;
  adapter.scan = async function* (pipeline, size) {
    assert.ok(pipeline.some((stage) => "$lookup" in stage));
    fallback++;
    yield* scan.call(this, pipeline, size);
  };
  try {
    assert.deepEqual(await read(query), {
      rows: [
        { name: "Art", count: 3, sum: 20 },
        { name: "Games", count: 1, sum: 11 },
        { name: "Books", count: 0, sum: 0 },
        { name: "Audio", count: 0, sum: 0 },
      ],
    });
    assert.equal(fallback, 2);
  } finally {
    adapter.scan = scan;
  }
});

test("expressions inspecting the whole child row retain the parent-scoped strategy", async () => {
  const child = productSource.derive(
    "stock",
    () =>
      new MongoExpression<number>(
        { $cond: [{ $eq: [{ $type: "$$ROOT" }, "object"] }, "$stock", 0] },
        new Set(["stock"]),
        (row) => Number(row.stock),
        schema.number(),
      ),
  );
  const products = categorySource
    .related(child, { localField: "_id", foreignField: "category" })
    .many(Numeric);
  const read = totals(products);
  const plan = read.inspect(query);
  assert.equal(
    plan.dependencies.count.execution,
    "bulk",
    "unused derivations stay pruned",
  );
  assert.equal(plan.dependencies.sum.execution, "parent-scoped");
  assert.match(plan.dependencies.sum.reason!, /expression/);
  assert.deepEqual((await read(query)).rows[2], {
    name: "Books",
    count: 2,
    sum: 10,
  });
});

test("bulk sums validate native outputs and reject finite-input overflow", async () => {
  await Products.collection.updateMany(
    { category: ids.books },
    { $set: { stock: Number.MAX_VALUE } },
  );
  const products = categorySource
    .related(productSource, { localField: "_id", foreignField: "category" })
    .many(Numeric);
  const read = totals(products);
  assert.equal(read.inspect(query).dependencies.sum.execution, "bulk");
  await assert.rejects(read(query), ReadValidationError);
});

test("bulk reductions bound key batches without truncating complete child inputs", async () => {
  const products = categorySource
    .related(productSource.toApp({ batchSize: 1 }), {
      localField: "_id",
      foreignField: "category",
    })
    .many(Numeric, { limits: { maxCandidates: 1 } });
  const adapter = products.options.source.state.collection;
  const scan = adapter.scan;
  const batches: number[] = [];
  adapter.scan = async function* (pipeline, size) {
    batches.push(
      (pipeline[0] as { $match: { category: { $in: unknown[] } } }).$match
        .category.$in.length,
    );
    assert.equal(size, 1);
    yield* scan.call(this, pipeline, size);
  };
  try {
    assert.deepEqual(await totals(products)(query), {
      rows: [
        { name: "Art", count: 0, sum: 0 },
        { name: "Games", count: 1, sum: 10 },
        { name: "Books", count: 2, sum: 10 },
        { name: "Audio", count: 1, sum: 0 },
      ],
    });
    assert.deepEqual(batches, Array(4).fill(1));
  } finally {
    adapter.scan = scan;
  }
});

test("a bulk reduction scans indexed children directly without per-parent lookups", async () => {
  await Products.collection.insertMany(
    Array.from({ length: 1000 }, (_, index) => ({
      category: new mongoose.Types.ObjectId(),
      name: `Other ${index}`,
      stock: 1,
      isActive: true,
    })),
  );
  await Products.collection.createIndex(
    { category: 1 },
    { name: "bulk_relation_key" },
  );
  const products = categorySource
    .related(productSource, {
      localField: "_id",
      foreignField: "category",
    })
    .many(Numeric);
  const adapter = products.options.source.state.collection;
  const scan = adapter.scan;
  let captured: PipelineStage[] = [];
  adapter.scan = async function* (pipeline, size) {
    captured = pipeline;
    yield* scan.call(this, pipeline, size);
  };
  try {
    await totals(products)(query);
    assert.ok(!captured.some((stage) => "$lookup" in stage));
    const explanation =
      await Products.aggregate(captured).explain("executionStats");
    assert.match(JSON.stringify(explanation), /"IXSCAN"/);
    const stats =
      explanation.executionStats ??
      explanation.stages.find((stage: { $cursor?: unknown }) => stage.$cursor)
        .$cursor.executionStats;
    assert.ok(stats.totalDocsExamined < 20);
  } finally {
    adapter.scan = scan;
    await Products.collection.dropIndex("bulk_relation_key");
  }
});

test("bulk result decoding rejects duplicate and unknown parent correlations", async () => {
  const products = categorySource
    .related(productSource, { localField: "_id", foreignField: "category" })
    .many(Numeric);
  const read = totals(products);
  const adapter = products.options.source.state.collection;
  const scan = adapter.scan;
  for (const id of [ids.art, new mongoose.Types.ObjectId()]) {
    adapter.scan = async function* (pipeline) {
      const group = (pipeline[pipeline.length - 1] as PipelineStage.Group)
        .$group;
      const values = Object.fromEntries(
        Object.keys(group)
          .filter((key) => key !== "_id")
          .map((key) => [key, key.includes("invalid") ? 0 : 1]),
      );
      yield { ...values, _id: id };
      yield { ...values, _id: id };
    };
    try {
      await assert.rejects(read(query), /Invalid bulk relation correlation/);
    } finally {
      adapter.scan = scan;
    }
  }
});

test("bulk average/minimum/maximum retain correlation through key overwrites and projection", async () => {
  const products = categorySource
    .related(productSource, { localField: "_id", foreignField: "category" })
    .derive("category", (e) => e.literal(ids.hidden))
    .where((e) => e.eq(e.field("category"), ids.hidden))
    .project(["stock"])
    .many(Numeric);
  const source = categorySource
    .load("average", products.avg({ field: "stock" }))
    .load("minimum", products.min({ field: "stock" }))
    .load("maximum", products.max({ field: "stock" }));
  const read = defineRead(
    defineResource({
      name: field.string(),
      average: field.number().nullable(),
      minimum: field.number().nullable(),
      maximum: field.number().nullable(),
    }),
    {
      source,
      scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
    },
  );
  const selection = {
    select: { name: true, average: true, minimum: true, maximum: true },
  } as const;
  for (const dependency of Object.values(read.inspect(selection).dependencies))
    assert.equal(dependency.execution, "bulk");
  assert.deepEqual(await read(selection), {
    rows: [
      { name: "Art", average: null, minimum: null, maximum: null },
      { name: "Games", average: 10, minimum: 10, maximum: 10 },
      { name: "Books", average: 5, minimum: 3, maximum: 7 },
      { name: "Audio", average: 0, minimum: 0, maximum: 0 },
    ],
  });
});

test("bulk numeric summaries deduplicate foreign arrays and preserve native fallbacks", async () => {
  await Products.collection.insertOne({
    category: [ids.books, ids.games, ids.books],
    stock: 9,
    name: "Shared",
  } as never);
  const expected = [
    { name: "Art", average: null, minimum: null, maximum: null },
    { name: "Games", average: 9.5, minimum: 9, maximum: 10 },
    { name: "Books", average: 19 / 3, minimum: 3, maximum: 9 },
    { name: "Audio", average: 0, minimum: 0, maximum: 0 },
  ];
  for (const opaque of [false, true]) {
    const joined = categorySource.related(productSource, {
      localField: "_id",
      foreignField: "category",
    });
    const products = (
      opaque
        ? joined.native({
            stages: [{ $project: { stock: 1 } }],
            output: schema.object({ stock: schema.number() }),
          })
        : joined.project(["stock"])
    ).many(Numeric);
    const source = categorySource
      .load("average", products.avg({ field: "stock" }))
      .load("minimum", products.min({ field: "stock" }))
      .load("maximum", products.max({ field: "stock" }));
    const read = defineRead(
      defineResource({
        name: field.string(),
        average: field.number().nullable(),
        minimum: field.number().nullable(),
        maximum: field.number().nullable(),
      }),
      {
        source,
        scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
      },
    );
    const selection = {
      select: { name: true, average: true, minimum: true, maximum: true },
    } as const;
    for (const dependency of Object.values(
      read.inspect(selection).dependencies,
    ))
      assert.equal(dependency.execution, opaque ? "parent-scoped" : "bulk");
    assert.deepEqual(await read(selection), { rows: expected });
  }
});
