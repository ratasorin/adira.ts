/** Loaded by read.test.ts with the shared isolated MongoDB lifecycle. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PipelineStage } from "mongoose";
import { defineResource, field, ReadWhere, schema } from "@n/adira.core.ts";
import { defineRead, mongo, MongoExpression } from "../read";
import { Categories, Products, ids } from "./fixtures";
import {
  nativeStockSource,
  readNativeStocks,
} from "./native-producers.fixture";

function nameMatches(pipeline: readonly unknown[]): number[] {
  // A native truth flag can filter before a lookup delayed until after the page.
  // Additional direct prefilters are only needed for enrichment that stays early.
  return pipeline.flatMap((stage, index) => {
    const value = stage as { $match?: unknown; $set?: Record<string, unknown> };
    const predicate =
      value.$match ||
      Object.keys(value.$set ?? {}).some((key) =>
        key.startsWith("__adira_pred_"),
      );
    return predicate && JSON.stringify(stage).includes('"$name"')
      ? [index]
      : [];
  });
}
const lookupAt = (pipeline: readonly unknown[]) =>
  pipeline.findIndex((stage) => "$lookup" in (stage as object));
const source = () =>
  mongo.from(Categories, { scope: (e) => e.eq(e.field("tenant"), "demo") });

test("base predicates run after input policy and before atomic native enrichment", async () => {
  const query = {
    select: { name: true, stockTotal: true },
    where: {
      $and: [{ name: { $eq: "Books" } }, { stockTotal: { $gte: 5 } }],
    },
  } as const;
  const pipeline = readNativeStocks.inspect(query).pipeline;
  const match = nameMatches(pipeline)[0];
  assert.ok(match > 0, "input policy stays first");
  assert.ok(match < lookupAt(pipeline));
  assert.ok(JSON.stringify(pipeline[0]).includes('"$tenant"'));
  // The final flags and complete filter still execute after enrichment.
  assert.ok(
    pipeline
      .slice(lookupAt(pipeline) + 1)
      .some((stage) => JSON.stringify(stage).includes('"$__adira_pred_')),
  );
  assert.deepEqual(await readNativeStocks(query), {
    rows: [{ name: "Books", stockTotal: 10 }],
  });
  const hidden = await readNativeStocks({
    select: { name: true, stockTotal: true },
    where: { name: { $eq: "Alien" } },
  });
  assert.deepEqual(hidden, { rows: [] });
});

const Mixed = defineResource({
  name: field.string().filterable("$eq", "$ne").orderable(),
  stockTotal: field.number().filterable("$gte"),
  score: field.number().filterable("$gte", "$lt"),
});
const booleanCases: {
  label: string;
  where: ReadWhere<typeof Mixed>;
  names: string[];
  early: boolean;
}[] = [
  {
    label: "conjunction with an app field",
    where: { $and: [{ name: { $eq: "Books" } }, { score: { $gte: 30 } }] },
    names: ["Books"],
    early: true,
  },
  {
    label: "disjunction with an unknown branch",
    where: { $or: [{ name: { $eq: "Art" } }, { score: { $gte: 30 } }] },
    names: ["Art", "Audio", "Books"],
    early: false,
  },
  {
    label: "negated mixed conjunction",
    where: {
      $not: { $and: [{ name: { $eq: "Books" } }, { score: { $gte: 30 } }] },
    },
    names: ["Art", "Audio", "Games"],
    early: false,
  },
  {
    label: "negated mixed disjunction",
    where: {
      $not: { $or: [{ name: { $eq: "Art" } }, { score: { $gte: 30 } }] },
    },
    names: ["Games"],
    early: false,
  },
  {
    label: "necessary conditions in every OR branch",
    where: {
      $or: [
        { $and: [{ name: { $eq: "Books" } }, { score: { $gte: 30 } }] },
        { $and: [{ name: { $eq: "Art" } }, { score: { $lt: 30 } }] },
      ],
    },
    names: ["Art", "Books"],
    early: true,
  },
  {
    label: "exact negation beside an app condition",
    where: {
      $and: [{ $not: { name: { $eq: "Books" } } }, { score: { $gte: 30 } }],
    },
    names: ["Audio"],
    early: true,
  },
  {
    label: "double negation",
    where: { $not: { $not: { name: { $eq: "Books" } } } },
    names: ["Books"],
    early: true,
  },
  {
    label: "a later native field inside OR",
    where: { $or: [{ name: { $eq: "Art" } }, { stockTotal: { $gte: 5 } }] },
    names: ["Art", "Books"],
    early: false,
  },
];
for (const entry of booleanCases)
  test(`pushdown preserves Boolean semantics: ${entry.label}`, async () => {
    const read = defineRead(Mixed, {
      source: nativeStockSource
        .toApp()
        .derive("score", ["subtotal"], (row) => row.subtotal),
    });
    const query = {
      select: { name: true, stockTotal: true },
      where: entry.where,
      orderBy: { name: "asc" },
    } as const;
    const plan = read.inspect(query);
    assert.equal(
      nameMatches(plan.pipeline).some(
        (index) => index < lookupAt(plan.pipeline),
      ),
      entry.early,
    );
    assert.deepEqual(
      (await read(query)).rows.map((row) => row.name),
      entry.names,
    );
  });

test("early scalar predicates retain null, missing, array, numeric, and literal semantics", async () => {
  await Categories.collection.updateOne(
    { _id: ids.art },
    { $unset: { name: "" } },
  );
  await Categories.collection.updateOne(
    { _id: ids.games },
    { $set: { name: null as never } },
  );
  await Categories.collection.updateOne(
    { _id: ids.books },
    { $set: { name: "$literal.$rand", subtotal: "30" as never } },
  );
  await Categories.collection.updateOne(
    { _id: ids.audio },
    { $set: { name: ["Books"] as never } },
  );
  const Resource = defineResource({
    slug: field.string().orderable(),
    name: field
      .string()
      .nullable()
      .filterable("$eq", "$ne", "$in", "$nin", "$startsWith", "$contains"),
    subtotal: field.number().nullable().filterable("$gte", "$lt"),
    stockTotal: field.number(),
  });
  const read = defineRead(Resource, { source: nativeStockSource });
  const cases: [ReadWhere<typeof Resource>, string[]][] = [
    [{ name: { $eq: null } }, ["art", "games"]],
    [{ name: { $ne: null } }, ["audio", "books"]],
    [{ name: { $in: [null, "$literal.$rand"] } }, ["art", "books", "games"]],
    [{ name: { $nin: [null, "$literal.$rand"] } }, ["audio"]],
    [{ name: { $eq: "Books" } }, []],
    [{ name: { $startsWith: "$literal" } }, ["books"]],
    [{ name: { $contains: "$rand" } }, ["books"]],
    [{ subtotal: { $gte: 25 } }, ["audio"]],
    [{ subtotal: { $lt: 25 } }, ["art", "games"]],
    [{ $not: { name: { $eq: null } } }, ["audio", "books"]],
  ];
  for (const [where, slugs] of cases) {
    const query = {
      select: { slug: true, stockTotal: true },
      where,
      orderBy: { slug: "asc" },
    } as const;
    assert.ok(lookupAt(read.inspect(query).pipeline) > 1);
    assert.deepEqual(
      (await read(query)).rows.map((row) => row.slug),
      slugs,
    );
  }
});

test("field overwrites stop pushdown at the final writer", async () => {
  for (const replaced of [
    nativeStockSource.derive("name", (e) => e.literal("Renamed")),
    nativeStockSource.native({
      provides: ["name"],
      requires: [],
      stages: [{ $set: { name: { $literal: "Renamed" } } }],
      output: schema.object({ name: schema.string() }),
    }),
  ]) {
    const source = replaced.derive("copy", (e) => e.field("subtotal"));
    const read = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        stockTotal: field.number(),
        copy: field.number(),
      }),
      { source },
    );
    const query = {
      select: { name: true, stockTotal: true, copy: true },
      where: { name: { $eq: "Renamed" } },
    } as const;
    const plan = read.inspect(query);
    assert.ok(nameMatches(plan.pipeline)[0] > lookupAt(plan.pipeline));
    assert.equal((await read(query)).rows.length, 4);
  }
});

test("native derived predicates can move after their writer and before unrelated enrichment", async () => {
  const upper = source().derive("name", (e) => e.upper(e.field("name")));
  const sourceWithCopy = upper.native({
    provides: ["copy"],
    requires: ["subtotal"],
    stages: [{ $set: { copy: "$subtotal" } }],
    output: schema.object({ copy: schema.number() }),
  });
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      copy: field.number(),
    }),
    { source: sourceWithCopy },
  );
  const query = {
    select: { name: true, copy: true },
    where: { name: { $eq: "BOOKS" } },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  const writer = pipeline.findIndex((stage) =>
    JSON.stringify(stage).includes('"$toUpper"'),
  );
  const copy = pipeline.findIndex((stage) =>
    JSON.stringify(stage).includes('"copy":"$subtotal"'),
  );
  assert.ok(
    nameMatches(pipeline)[0] > writer && nameMatches(pipeline)[0] < copy,
  );
  assert.deepEqual(await read(query), { rows: [{ name: "BOOKS", copy: 30 }] });
});

test("row-preserving global windows are barriers, while later local work can be crossed", async () => {
  const sourceWithTotal = source()
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
    .native({
      provides: ["copy"],
      requires: ["subtotal"],
      stages: [{ $set: { copy: "$subtotal" } }],
      output: schema.object({ copy: schema.number() }),
    });
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      total: field.number(),
      copy: field.number(),
    }),
    { source: sourceWithTotal },
  );
  const query = {
    select: { name: true, total: true, copy: true },
    where: { name: { $eq: "Books" } },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  const window = pipeline.findIndex(
    (stage) => "$setWindowFields" in (stage as object),
  );
  const copy = pipeline.findIndex((stage) =>
    JSON.stringify(stage).includes('"copy":"$subtotal"'),
  );
  assert.ok(
    nameMatches(pipeline)[0] > window && nameMatches(pipeline)[0] < copy,
  );
  assert.deepEqual(await read(query), {
    rows: [{ name: "Books", total: 100, copy: 30 }],
  });
});

test("unconditional native limits retain their parent membership semantics", async () => {
  const limited = source()
    .native({
      stages: [{ $sort: { _id: 1 } }, { $limit: 2 }],
      output: schema.object({
        name: schema.string(),
        subtotal: schema.number(),
      }),
    })
    .derive("copy", (e) => e.field("subtotal"));
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      copy: field.number(),
    }),
    { source: limited },
  );
  const query = {
    select: { name: true, copy: true },
    where: { name: { $eq: "Books" } },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  assert.ok(
    nameMatches(pipeline)[0] >
      pipeline.findIndex((stage) => "$limit" in (stage as object)),
  );
  assert.deepEqual(await read(query), { rows: [] });
});

for (const kind of ["expression", "lookup"] as const)
  test(`nonrepeatable ${kind} computations remain barriers`, async () => {
    const stages: PipelineStage[] =
      kind === "expression"
        ? [{ $set: { value: { $rand: {} } } }]
        : [
            {
              $lookup: {
                from: Products.collection.name,
                pipeline: [{ $sample: { size: 1 } }],
                as: "_sample",
              },
            },
            { $set: { value: { $size: "$_sample" } } },
            { $unset: "_sample" },
          ];
    const native = source()
      .native({
        provides: ["value"],
        requires: [],
        stages,
        output: schema.object({ value: schema.number() }),
      })
      .derive("copy", (e) => e.field("subtotal"));
    const read = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        value: field.number(),
        copy: field.number(),
      }),
      { source: native },
    );
    const query = {
      select: { name: true, value: true, copy: true },
      where: { name: { $eq: "Books" } },
    } as const;
    const pipeline = read.inspect(query).pipeline;
    const lastRandom = pipeline.findIndex((stage) =>
      kind === "expression"
        ? JSON.stringify(stage).includes('"$rand"')
        : "$unset" in (stage as object),
    );
    assert.ok(nameMatches(pipeline)[0] > lastRandom);
    assert.deepEqual(
      (await read(query)).rows.map((row) => row.name),
      ["Books"],
    );
  });

test("nonrepeatable predicate preparation prevents early filtering across it", async () => {
  const native = nativeStockSource;
  const Resource = defineResource(
    { name: field.string().filterable("$eq"), stockTotal: field.number() },
    {
      predicates: { random: field.boolean().filterable("$eq") },
    },
  );
  const read = defineRead(Resource, {
    source: native,
    filters: {
      random: {
        $eq: () =>
          native.condition(
            () =>
              new MongoExpression(
                { $gte: [{ $rand: {} }, 0] },
                new Set(),
                () => true,
                schema.boolean(),
              ),
          ),
      },
    },
  });
  const query = {
    select: { name: true, stockTotal: true },
    where: { name: { $eq: "Books" }, random: { $eq: true } },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  assert.ok(nameMatches(pipeline).every((index) => index > lookupAt(pipeline)));
  assert.deepEqual(await read(query), {
    rows: [{ name: "Books", stockTotal: 10 }],
  });
});

test("base filters can precede deterministic custom predicate lookups", async () => {
  const native = source();
  const Resource = defineResource(
    { name: field.string().filterable("$eq") },
    { predicates: { available: field.boolean().filterable("$eq") } },
  );
  const read = defineRead(Resource, {
    source: native,
    filters: {
      available: {
        $eq: (expected) =>
          native.pipelineCondition({
            requires: ["_id"],
            preservesRows: true,
            stages: [
              {
                $lookup: {
                  from: Products.collection.name,
                  localField: "_id",
                  foreignField: "category",
                  pipeline: [
                    { $match: { isActive: true } },
                    { $project: { stock: 1, _id: 0 } },
                  ],
                  as: "matching",
                },
              },
            ],
            output: schema.object({
              matching: schema.array(schema.object({ stock: schema.number() })),
            }),
            test: (e) => e.eq(e.gt(e.size(e.field("matching")), 0), expected),
          }),
      },
    },
  });
  const query = {
    select: { name: true },
    where: { name: { $eq: "Books" }, available: { $eq: true } },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  assert.ok(nameMatches(pipeline)[0] < lookupAt(pipeline));
  assert.deepEqual(await read(query), { rows: [{ name: "Books" }] });
});

test("custom native conditions and projections retain their dependency boundary", async () => {
  const native = nativeStockSource
    .project(["name", "stockTotal"])
    .derive("label", (e) => e.upper(e.field("name")));
  const Resource = defineResource(
    { label: field.string(), stockTotal: field.number() },
    { predicates: { named: field.string().filterable("$eq") } },
  );
  const read = defineRead(Resource, {
    source: native,
    filters: {
      named: {
        $eq: (value) => native.condition((e) => e.eq(e.field("name"), value)),
      },
    },
  });
  const query = {
    select: { label: true, stockTotal: true },
    where: { named: { $eq: "Books" } },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  assert.ok(nameMatches(pipeline)[0] < lookupAt(pipeline));
  assert.deepEqual(await read(query), {
    rows: [{ label: "BOOKS", stockTotal: 10 }],
  });
});

test("opaque app maps and whole-batch calculations retain their complete candidates", async () => {
  const mapped = nativeStockSource
    .toApp()
    .map((row) => ({ ...row, name: row.name === "Art" ? "Books" : "Other" }));
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      stockTotal: field.number(),
    }),
    { source: mapped },
  );
  const query = {
    select: { name: true, stockTotal: true },
    where: { name: { $eq: "Books" } },
  } as const;
  assert.equal(nameMatches(read.inspect(query).pipeline).length, 0);
  assert.deepEqual(await read(query), {
    rows: [{ name: "Books", stockTotal: 0 }],
  });
  const batched = source()
    .toApp({ batchSize: 10 })
    .transformBatch((rows) => {
      const total = rows.reduce((sum, row) => sum + row.subtotal, 0);
      return rows.map((row) => ({ ...row, total }));
    });
  const batchRead = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      total: field.number(),
    }),
    { source: batched },
  );
  assert.deepEqual(
    await batchRead({
      select: { name: true, total: true },
      where: { name: { $eq: "Books" } },
    }),
    { rows: [{ name: "Books", total: 100 }] },
  );
});

test("child predicate pushdown works in fused includes, deferred includes, and reductions", async () => {
  for (const deferred of [false, true]) {
    const native = source();
    const parent = deferred
      ? native.toApp().filter(() => true)
      : native.toApp();
    const child = mongo.from(Products).native({
      provides: ["copy"],
      requires: ["stock"],
      stages: [{ $set: { copy: "$stock" } }],
      output: schema.object({ copy: schema.number() }),
    });
    const Item = defineResource({
      name: field.string().filterable("$eq"),
      copy: field.number(),
    });
    const products = parent
      .related(child, { localField: "_id", foreignField: "category" })
      .many(Item);
    const loaded = parent.load(
      "sum",
      products.sum({ field: "copy", where: { name: { $eq: "Book A" } } }),
    );
    const read = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        products: field.many(Item),
        sum: field.number(),
      }),
      { source: loaded, relations: { products } },
    );
    const query = {
      select: {
        name: true,
        sum: true,
        products: {
          select: { name: true, copy: true },
          where: { name: { $eq: "Book A" } },
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
    assert.equal(plan.dependencies.sum.strategy, "mongodb");
    assert.ok(
      nameMatches(pipeline)[0] <
        pipeline.findIndex((stage) =>
          JSON.stringify(stage).includes('"copy":"$stock"'),
        ),
    );
    assert.deepEqual(await read(query), {
      rows: [
        { name: "Books", sum: 3, products: [{ name: "Book A", copy: 3 }] },
      ],
    });
  }
});
