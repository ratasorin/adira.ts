/** Loaded by read.test.ts with its isolated MongoDB lifecycle and seed hooks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PipelineStage } from "mongoose";
import { defineResource, field, schema } from "@n/adira.core.ts";
import { defineRead, mongo, MongoExpression } from "../read";
import { Categories, Products } from "./fixtures";
import {
  nativeStockSource,
  NativeStockResource,
  readNativeStocks,
} from "./native-producers.fixture";

const lookupAt = (pipeline: readonly unknown[]) =>
  pipeline.findIndex((stage) => "$lookup" in (stage as object));
const limitAt = (pipeline: readonly unknown[]) =>
  pipeline.findIndex((stage) => "$limit" in (stage as object));
const source = () =>
  mongo.from(Categories, {
    scope: (e) => e.eq(e.field("tenant"), "demo"),
  });

test("display-only native lookups execute after offset and limit for the selected parents", async () => {
  const registered = JSON.stringify(nativeStockSource.state.stages);
  const query = {
    select: { name: true, stockTotal: true, productCount: true },
    page: { offset: 2, limit: 1 },
  } as const;
  const plan = readNativeStocks.inspect(query);
  const skip = plan.pipeline.findIndex((stage) => "$skip" in (stage as object));
  assert.ok(skip >= 0 && skip < limitAt(plan.pipeline));
  assert.ok(limitAt(plan.pipeline) < lookupAt(plan.pipeline));
  assert.deepEqual(await readNativeStocks(query), {
    rows: [{ name: "Books", stockTotal: 10, productCount: 2 }],
  });
  const explanation = (await Categories.aggregate(
    plan.pipeline as PipelineStage[],
  ).explain("executionStats")) as {
    stages: { $lookup?: { as: string }; nReturned?: number }[];
  };
  assert.equal(
    explanation.stages.find((stage) => stage.$lookup?.as === "_stockSummary")
      ?.nReturned,
    1,
  );
  // Reusing a source for a computed filter must restore the necessary early work.
  const filtered = {
    select: { name: true },
    where: { stockTotal: { $gte: 5 } },
    page: { limit: 1 },
  } as const;
  const filterPlan = readNativeStocks.inspect(filtered);
  assert.ok(lookupAt(filterPlan.pipeline) < limitAt(filterPlan.pipeline));
  assert.deepEqual(await readNativeStocks(filtered), {
    rows: [{ name: "Books" }],
  });
  assert.equal(JSON.stringify(nativeStockSource.state.stages), registered);
});

test("transitive native and app display dependencies retain their values after pagination", async () => {
  const native = nativeStockSource
    .native({
      provides: ["doubled"],
      requires: ["stockTotal"],
      stages: [{ $set: { doubled: { $multiply: ["$stockTotal", 2] } } }],
      output: schema.object({ doubled: schema.number() }),
    })
    .derive("final", (e) => e.add(e.field("doubled"), e.literal(1)));
  const app = native
    .toApp()
    .derive("label", ["final"], ({ final }) => `Stock ${final}`);
  const read = defineRead(
    defineResource({ name: field.string().orderable(), label: field.string() }),
    { source: app },
  );
  const query = {
    select: { name: true, label: true },
    orderBy: { name: "asc" },
    page: { offset: 2, limit: 1 },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  assert.ok(limitAt(pipeline) < lookupAt(pipeline));
  assert.ok(
    pipeline.findIndex((stage) => JSON.stringify(stage).includes('"final"')) >
      lookupAt(pipeline),
  );
  assert.deepEqual(await read(query), {
    rows: [{ name: "Books", label: "Stock 21" }],
  });
});

for (const [label, query] of [
  ["computed filter", { where: { stockTotal: { $gte: 5 } } }],
  ["computed ordering", { orderBy: { stockTotal: "desc" } }],
  [
    "computed OR branch",
    {
      where: { $or: [{ name: { $eq: "Games" } }, { stockTotal: { $gte: 5 } }] },
    },
  ],
  ["computed negation", { where: { $not: { stockTotal: { $gte: 5 } } } }],
] as const)
  test(`${label} keeps its native producer before pagination`, async () => {
    const input = {
      select: { name: true, stockTotal: true },
      ...query,
      page: { limit: 1 },
    } as const;
    const pipeline = readNativeStocks.inspect(input).pipeline;
    assert.ok(lookupAt(pipeline) < limitAt(pipeline));
    const result = await readNativeStocks(input);
    assert.equal(
      result.rows[0].name,
      label === "computed negation" ? "Art" : "Books",
    );
  });

test("default ordering, reader scope, and sibling producer outputs remain early dependencies", async () => {
  const Resource = defineResource({
    name: field.string(),
    stockTotal: field.number().orderable(),
    productCount: field.number().orderable(),
  });
  for (const read of [
    defineRead(Resource, {
      source: nativeStockSource,
      defaultOrderBy: { stockTotal: "desc" },
    }),
    defineRead(Resource, {
      source: nativeStockSource,
      defaultOrderBy: { productCount: "desc" },
    }),
    defineRead(Resource, {
      source: nativeStockSource,
      scope: () =>
        nativeStockSource.condition((e) => e.gt(e.field("stockTotal"), 0)),
    }),
  ]) {
    const query = {
      select: { name: true, stockTotal: true },
      page: { limit: 1 },
    } as const;
    const pipeline = read.inspect(query).pipeline;
    assert.ok(lookupAt(pipeline) < limitAt(pipeline));
    assert.deepEqual(await read(query), {
      rows: [{ name: "Books", stockTotal: 10 }],
    });
  }
});

test("native source filters and sorts retain their original membership and ordering", async () => {
  for (const native of [
    nativeStockSource.where((e) => e.gt(e.field("stockTotal"), 0)),
    nativeStockSource.sortBy({ stockTotal: -1 }),
  ]) {
    const read = defineRead(NativeStockResource, { source: native });
    const query = {
      select: { name: true, stockTotal: true },
      page: { limit: 1 },
    } as const;
    const pipeline = read.inspect(query).pipeline;
    assert.ok(lookupAt(pipeline) < limitAt(pipeline));
    assert.deepEqual(await read(query), {
      rows: [{ name: "Books", stockTotal: 10 }],
    });
  }
});

test("a display suffix preserves overwritten field versions", async () => {
  const native = nativeStockSource
    .derive("subtotal", (e) => e.literal(7))
    .derive("value", (e) => e.add(e.field("stockTotal"), e.field("subtotal")));
  const read = defineRead(
    defineResource({ name: field.string().orderable(), value: field.number() }),
    { source: native },
  );
  const query = {
    select: { name: true, value: true },
    orderBy: { name: "asc" },
    page: { offset: 2, limit: 1 },
  } as const;
  assert.ok(
    limitAt(read.inspect(query).pipeline) <
      lookupAt(read.inspect(query).pipeline),
  );
  assert.deepEqual(await read(query), { rows: [{ name: "Books", value: 17 }] });
  const renamed = defineRead(NativeStockResource, {
    source: nativeStockSource.derive("name", (e) => e.literal("Renamed")),
  });
  const named = {
    select: { name: true, stockTotal: true },
    where: { name: { $eq: "Renamed" } },
  } as const;
  const pipeline = renamed.inspect(named).pipeline;
  assert.ok(lookupAt(pipeline) < limitAt(pipeline));
  assert.equal((await renamed(named)).rows.length, 4);
});

test("global native totals stay before pagination while later local display work can move", async () => {
  const native = source()
    .native({
      provides: ["total"],
      requires: ["subtotal"],
      stages: [
        {
          $setWindowFields: {
            output: {
              total: {
                $sum: "$subtotal",
                window: { documents: ["unbounded", "unbounded"] },
              },
            },
          },
        },
      ],
      output: schema.object({ total: schema.number() }),
    })
    .derive("doubled", (e) => e.multiply(e.field("total"), e.literal(2)));
  const read = defineRead(
    defineResource({
      name: field.string().orderable(),
      total: field.number(),
      doubled: field.number(),
    }),
    { source: native },
  );
  const query = {
    select: { name: true, total: true, doubled: true },
    orderBy: { name: "asc" },
    page: { offset: 2, limit: 1 },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  const window = pipeline.findIndex(
    (stage) => "$setWindowFields" in (stage as object),
  );
  const doubled = pipeline.findIndex((stage) =>
    JSON.stringify(stage).includes('"doubled"'),
  );
  assert.ok(window < limitAt(pipeline) && limitAt(pipeline) < doubled);
  assert.deepEqual(await read(query), {
    rows: [{ name: "Books", total: 100, doubled: 200 }],
  });
});

test("projections, random computations, and raw transforms remain native pagination boundaries", async () => {
  const random = nativeStockSource.derive(
    "random",
    () =>
      new MongoExpression({ $rand: {} }, new Set(), () => 0, schema.number()),
  );
  const projected = nativeStockSource.project([
    "name",
    "stockTotal",
    "productCount",
  ]);
  const raw = nativeStockSource.native({
    stages: [{ $replaceWith: "$$ROOT" }],
    output: schema.object({
      name: schema.string(),
      stockTotal: schema.number(),
      productCount: schema.number(),
    }),
  });
  for (const native of [random, projected, raw]) {
    const read = defineRead(NativeStockResource, {
      source: native,
      defaultOrderBy: { name: "asc" },
    });
    // An opaque source callback observes all its native input, keeping random live.
    const sourceRead =
      native === random
        ? defineRead(NativeStockResource, {
            source: random.toApp().map((row) => ({ ...row })),
            defaultOrderBy: {},
          })
        : read;
    const query = {
      select: { name: true, stockTotal: true },
      page: { limit: 1 },
    } as const;
    const pipeline = sourceRead.inspect(query).pipeline;
    assert.ok(lookupAt(pipeline) < limitAt(pipeline));
    assert.equal((await sourceRead(query)).rows.length, 1);
  }
});

test("application filtering and sorting keep complete native candidates", async () => {
  const app = nativeStockSource
    .toApp()
    .derive("score", ["stockTotal"], ({ stockTotal }) => stockTotal);
  const Resource = defineResource({
    name: field.string(),
    score: field.number().filterable("$gte").orderable(),
  });
  const read = defineRead(Resource, { source: app });
  for (const query of [
    {
      select: { name: true, score: true },
      where: { score: { $gte: 5 } },
      page: { limit: 1 },
    },
    {
      select: { name: true, score: true },
      orderBy: { score: "desc" },
      page: { limit: 1 },
    },
  ] as const) {
    const pipeline = read.inspect(query).pipeline;
    assert.equal(limitAt(pipeline), -1);
    assert.deepEqual(await read(query), {
      rows: [{ name: "Books", score: 10 }],
    });
  }
});

test("nested native enrichment follows each child's page in fused and deferred includes", async () => {
  for (const deferred of [false, true]) {
    const native = source();
    const parent = deferred
      ? native.toApp().filter(() => true)
      : native.toApp();
    const child = mongo.from(Products).native({
      provides: ["categoryTax"],
      requires: ["category"],
      stages: [
        {
          $lookup: {
            from: Categories.collection.name,
            localField: "category",
            foreignField: "_id",
            pipeline: [{ $project: { tax: 1 } }],
            as: "_category",
          },
        },
        { $set: { categoryTax: { $arrayElemAt: ["$_category.tax", 0] } } },
        { $unset: "_category" },
      ],
      output: schema.object({ categoryTax: schema.number() }),
    });
    const Item = defineResource({
      name: field.string().orderable(),
      categoryTax: field.number(),
    });
    const products = parent
      .related(child, { localField: "_id", foreignField: "category" })
      .many(Item);
    const read = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        products: field.many(Item),
      }),
      { source: parent, relations: { products } },
    );
    const query = {
      select: {
        name: true,
        products: {
          select: { name: true, categoryTax: true },
          orderBy: { name: "asc" },
          page: { offset: 1, limit: 1 },
        },
      },
      where: { name: { $eq: "Books" } },
    } as const;
    const plan = read.inspect(query);
    const pipeline = plan.relations.products.pipeline;
    assert.equal(
      plan.relationStrategies.products,
      deferred ? "batched-lookup" : "lookup",
    );
    assert.ok(limitAt(pipeline) < lookupAt(pipeline));
    assert.deepEqual(await read(query), {
      rows: [{ name: "Books", products: [{ name: "Book B", categoryTax: 6 }] }],
    });
  }
});

test("complete aggregate dependencies do not acquire a display page", async () => {
  const parent = source();
  const child = mongo.from(Products).native({
    provides: ["copy"],
    requires: ["stock"],
    stages: [{ $set: { copy: "$stock" } }],
    output: schema.object({ copy: schema.number() }),
  });
  const Item = defineResource({ copy: field.number() });
  const products = parent
    .related(child, { localField: "_id", foreignField: "category" })
    .many(Item, { limits: { defaultLimit: 1, maxLimit: 1 } });
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      sum: field.number(),
    }),
    { source: parent.toApp().load("sum", products.sum({ field: "copy" })) },
  );
  const query = {
    select: { name: true, sum: true },
    where: { name: { $eq: "Books" } },
  } as const;
  const dependency = read.inspect(query).dependencies.sum;
  assert.equal(dependency.strategy, "mongodb");
  assert.equal(limitAt(dependency.pipeline), -1);
  assert.deepEqual(await read(query), { rows: [{ name: "Books", sum: 10 }] });
});

test("whole-document expressions cannot observe planner metadata added before pagination", async () => {
  for (const variable of ["$$ROOT", "$$CURRENT"]) {
    const native = nativeStockSource.derive(
      "width",
      () =>
        new MongoExpression(
          { $size: { $objectToArray: variable } },
          new Set(nativeStockSource.state.nativeKeys),
          () => 0,
          schema.number(),
        ),
    );
    const baseline = await Categories.aggregate([
      ...native.state.stages,
      { $match: { name: "Books" } },
    ]);
    const read = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        width: field.number(),
      }),
      { source: native },
    );
    const query = {
      select: { width: true },
      where: { name: { $eq: "Books" } },
      page: { limit: 1 },
    } as const;
    const pipeline = read.inspect(query).pipeline;
    assert.ok(lookupAt(pipeline) < limitAt(pipeline));
    assert.deepEqual(await read(query), {
      rows: [{ width: baseline[0].width }],
    });
  }
  const current = source().derive(
    "subtotalCopy",
    () =>
      new MongoExpression<number>(
        { $getField: "subtotal" },
        new Set(["subtotal"]),
        (row) => row.subtotal as number,
        schema.number(),
      ),
  );
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      subtotalCopy: field.number(),
    }),
    { source: current },
  );
  const query = {
    select: { subtotalCopy: true },
    where: { name: { $eq: "Books" } },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  assert.ok(
    pipeline.findIndex((stage) =>
      JSON.stringify(stage).includes('"$getField"'),
    ) < limitAt(pipeline),
  );
  assert.deepEqual(await read(query), { rows: [{ subtotalCopy: 30 }] });
});

test("foreign whole-document grouping can move while parent whole-document capture stays early", async () => {
  for (const parentRoot of [false, true]) {
    const native = source().native({
      provides: ["value"],
      requires: ["_id"],
      stages: [
        {
          $lookup: {
            from: Products.collection.name,
            localField: "_id",
            foreignField: "category",
            ...(parentRoot ? { let: { doc: "$$ROOT" } } : {}),
            pipeline: parentRoot
              ? [
                  { $limit: 1 },
                  {
                    $project: { value: { $size: { $objectToArray: "$$doc" } } },
                  },
                ]
              : [
                  { $group: { _id: null, docs: { $push: "$$ROOT" } } },
                  { $project: { value: { $size: "$docs" } } },
                ],
            as: "_data",
          },
        },
        { $set: { value: { $arrayElemAt: ["$_data.value", 0] } } },
        { $unset: "_data" },
      ],
      output: schema.object({ value: schema.number() }),
    });
    const baseline = await Categories.aggregate([
      ...native.state.stages,
      { $match: { name: "Books" } },
    ]);
    const read = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        value: field.number(),
      }),
      { source: native },
    );
    const query = {
      select: { value: true },
      where: { name: { $eq: "Books" } },
      page: { limit: 1 },
    } as const;
    const pipeline = read.inspect(query).pipeline;
    assert.equal(lookupAt(pipeline) < limitAt(pipeline), parentRoot);
    assert.deepEqual(await read(query), {
      rows: [{ value: baseline[0].value }],
    });
  }
});

test("native temporary writes cannot overwrite predicate flags after pagination", async () => {
  const native = source().native({
    provides: ["value"],
    requires: ["subtotal"],
    stages: [
      { $set: { __adira_pred_0: "$subtotal", value: "$subtotal" } },
      { $unset: "__adira_pred_0" },
    ],
    output: schema.object({ value: schema.number() }),
  });
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      value: field.number(),
    }),
    { source: native },
  );
  const query = {
    select: { value: true },
    where: { name: { $eq: "Books" } },
    page: { limit: 1 },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  assert.ok(
    pipeline.findIndex((stage) =>
      JSON.stringify(stage).includes('"value":"$subtotal"'),
    ) < limitAt(pipeline),
  );
  assert.deepEqual(await read(query), { rows: [{ value: 30 }] });
});

test("display-only expressions and validation execute only for page rows, including empty pages", async () => {
  let validations = 0;
  const native = source().native({
    provides: ["value"],
    requires: ["name", "subtotal"],
    stages: [
      {
        $set: {
          value: {
            $cond: [
              { $eq: ["$name", "Books"] },
              7,
              { $divide: [1, { $subtract: ["$subtotal", "$subtotal"] }] },
            ],
          },
        },
      },
    ],
    output: schema.object({
      value: schema.custom<number>((value) => {
        validations++;
        return schema.number().parse(value);
      }),
    }),
  });
  const read = defineRead(
    defineResource({
      name: field.string().orderable(),
      value: field.number().filterable("$gte"),
    }),
    { source: native },
  );
  assert.deepEqual(
    await read({
      select: { name: true, value: true },
      orderBy: { name: "asc" },
      page: { offset: 2, limit: 1 },
    }),
    { rows: [{ name: "Books", value: 7 }] },
  );
  assert.equal(validations, 1);
  assert.deepEqual(
    await read({ select: { value: true }, page: { offset: 100, limit: 1 } }),
    { rows: [] },
  );
  assert.equal(validations, 1);
  await assert.rejects(
    read({
      select: { value: true },
      where: { value: { $gte: 1 } },
      page: { limit: 1 },
    }),
    /divide by zero/i,
  );
});
