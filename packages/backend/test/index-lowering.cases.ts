/** Loaded by read.test.ts with the shared isolated MongoDB lifecycle. */
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Schema, type PipelineStage } from "mongoose";
import {
  defineResource,
  field,
  type ReadWhere,
  schema,
} from "@n/adira.core.ts";
import { createReadContext, defineRead, mongo, MongoExpression } from "../read";
import { scalarMatch } from "../read/index-match";
import { Categories, Creators, ids } from "./fixtures";

const Slug = defineResource({ slug: field.string().orderable() });
const scoped = () =>
  mongo.from(Categories, {
    scope: (e) => e.eq(e.field("tenant"), "demo"),
  });
function matchAt(pipeline: readonly unknown[], field: string): number {
  return pipeline.findIndex((stage) => {
    const match = (stage as { $match?: Record<string, unknown> }).$match;
    return match !== undefined && field in match;
  });
}

test("base policies and frontend numeric ranges use a compound index without hints", async () => {
  interface Row {
    tenant: string;
    deletedAt: Date | null;
    amount: number;
    label: string;
  }
  const Model = mongoose.model<Row>(
    "IndexLoweringProof",
    new Schema<Row>({
      tenant: String,
      deletedAt: Date,
      amount: Number,
      label: String,
    }),
  );
  try {
    const documents = Array.from({ length: 2400 }, (_, index) => ({
      tenant: `tenant-${Math.floor(index / 600)}`,
      deletedAt: index % 19 === 0 ? new Date(1) : null,
      amount: index % 600,
      label: String(index),
    }));
    await Model.insertMany(documents);
    await Model.collection.createIndex({ tenant: 1, deletedAt: 1, amount: 1 });
    const source = mongo.from(Model, {
      scope: (e) =>
        e.and(
          e.eq(e.field("tenant"), "tenant-3"),
          e.isNull(e.field("deletedAt")),
        ),
    });
    const read = defineRead(
      defineResource({
        label: field.string().orderable(),
        amount: field.number().filterable("$gte", "$lt"),
      }),
      { source },
    );
    const query = {
      select: { label: true },
      where: { amount: { $gte: 590, $lt: 595 } },
      orderBy: { label: "asc" },
    } as const;
    assert.deepEqual((await read(query)).rows, [
      { label: "2390" },
      { label: "2391" },
      { label: "2392" },
      { label: "2393" },
    ]);
    type Cursor = {
      queryPlanner?: { winningPlan: unknown };
      executionStats?: { totalDocsExamined: number; totalKeysExamined: number };
    };
    const explanation = (await Model.aggregate(
      read.inspect(query).pipeline as PipelineStage[],
    ).explain("executionStats")) as Cursor & {
      stages?: { $cursor?: Cursor }[];
    };
    const cursor =
      explanation.stages?.find((stage) => stage.$cursor)?.$cursor ??
      explanation;
    assert.match(JSON.stringify(cursor.queryPlanner?.winningPlan), /"IXSCAN"/);
    assert.ok(cursor.executionStats!.totalKeysExamined > 0);
    assert.ok(cursor.executionStats!.totalDocsExamined < 30);
  } finally {
    await Model.collection.drop();
    mongoose.deleteModel("IndexLoweringProof");
  }
});

test("input scope remains exact before native work and is evaluated once per compilation", async () => {
  // Ordinary Mongo equality admits this array; Adira's scalar policy must not.
  await Categories.collection.updateOne(
    { _id: ids.art },
    { $set: { tenant: ["demo"] as never, subtotal: 0 } },
  );
  const backend = createReadContext<{ tenant: string }>();
  let calls = 0;
  const source = backend.mongo
    .from(Categories, {
      scope: (e, context) => {
        calls++;
        return e.eq(e.field("tenant"), context.tenant);
      },
    })
    .derive(
      "inverse",
      () =>
        new MongoExpression(
          { $divide: [1, "$subtotal"] },
          new Set(["subtotal"]),
          () => 1,
          schema.number(),
        ),
    );
  const read = backend.defineRead(
    defineResource({
      slug: field.string().orderable(),
      inverse: field.number(),
    }),
    { source },
  );
  const query = {
    select: { slug: true, inverse: true },
    orderBy: { slug: "asc" },
  } as const;
  for (const [tenant, slugs] of [
    ["demo", ["audio", "books", "games"]],
    ["other", ["hidden"]],
  ] as const) {
    const count = calls;
    assert.deepEqual(read.inspect(query, { tenant }).pipeline[0], {
      $match: {
        tenant: { $eq: tenant },
        $expr: { $eq: [{ $ifNull: ["$tenant", null] }, { $literal: tenant }] },
      },
    });
    assert.equal(calls, count + 1);
    assert.deepEqual(
      (await read(query, { tenant })).rows.map((row) => row.slug),
      slugs,
    );
    assert.equal(calls, count + 2);
  }
});

test("lowered scalar filters preserve missing, null, array, Boolean, and numeric semantics", async () => {
  await Categories.collection.updateOne(
    { _id: ids.art },
    { $unset: { name: "" }, $set: { subtotal: [20] as never } },
  );
  await Categories.collection.updateOne(
    { _id: ids.games },
    { $set: { name: null as never, subtotal: "20" as never } },
  );
  await Categories.collection.updateOne(
    { _id: ids.books },
    { $set: { name: "$literal.[x]" } },
  );
  await Categories.collection.updateOne(
    { _id: ids.audio },
    { $set: { name: ["Books", null] as never, isActive: [true] as never } },
  );
  const Resource = defineResource({
    slug: field.string().orderable(),
    name: field.string().nullable().filterable("$eq", "$ne", "$in", "$nin"),
    subtotal: field.number().filterable("$gt", "$gte", "$lt", "$lte"),
    isActive: field.boolean().filterable("$eq", "$in"),
  });
  const read = defineRead(Resource, { source: scoped() });
  const cases: [ReadWhere<typeof Resource>, string[]][] = [
    [{ name: { $eq: null } }, ["art", "games"]],
    [{ name: { $eq: "Books" } }, []],
    [{ name: { $eq: "$literal.[x]" } }, ["books"]],
    [{ name: { $in: [] } }, []],
    [{ name: { $in: ["Books"] } }, []],
    [{ name: { $in: [null, "$literal.[x]"] } }, ["art", "books", "games"]],
    [{ name: { $ne: null } }, ["audio", "books"]],
    [{ name: { $ne: "Books" } }, ["art", "audio", "books", "games"]],
    [{ name: { $nin: [null, "$literal.[x]"] } }, ["audio"]],
    [{ $not: { name: { $eq: null } } }, ["audio", "books"]],
    [{ $not: { name: { $eq: "Books" } } }, ["art", "audio", "books", "games"]],
    [{ subtotal: { $gte: 20 } }, ["audio", "books"]],
    [{ subtotal: { $gt: 30 } }, ["audio"]],
    [{ subtotal: { $lt: 40 } }, ["books"]],
    [{ subtotal: { $lte: 40 } }, ["audio", "books"]],
    [{ isActive: { $eq: true } }, ["books"]],
    [{ isActive: { $in: [true, false] } }, ["art", "books", "games"]],
    [
      { $or: [{ name: { $eq: "Books" } }, { $not: { name: { $eq: null } } }] },
      ["audio", "books"],
    ],
  ];
  for (const [where, slugs] of cases)
    assert.deepEqual(
      (
        await read({
          select: { slug: true },
          where,
          orderBy: { slug: "asc" },
        })
      ).rows.map((row) => row.slug),
      slugs,
      JSON.stringify(where),
    );
});

test("legacy BSON undefined stays inside the necessary null and membership filters", () => {
  assert.deepEqual(scalarMatch("value", "$eq", null), {
    $or: [{ value: { $eq: null } }, { value: { $type: "undefined" } }],
  });
  assert.deepEqual(scalarMatch("value", "$in", [null, "x"]), {
    $or: [{ value: { $in: [null, "x"] } }, { value: { $type: "undefined" } }],
  });
  for (const operand of [undefined, /x/, ["x"], { x: 1 }, NaN, Infinity])
    assert.equal(scalarMatch("value", "$eq", operand), undefined);
  for (const operator of ["$not", "$ne", "$nin", "$contains", "$startsWith"])
    assert.equal(scalarMatch("value", operator, "x"), undefined);
});

test("ObjectId and Date source comparisons retain BSON values and exact policies", async () => {
  const date = new Date("2026-01-01T00:00:00Z");
  await Creators.collection.updateOne(
    { _id: ids.ana },
    { $set: { deletedAt: date } },
  );
  const source = mongo.from(Creators, {
    scope: (e) =>
      e.and(e.eq(e.field("_id"), ids.ana), e.eq(e.field("deletedAt"), date)),
  });
  const read = defineRead(defineResource({ name: field.string() }), { source });
  const query = { select: { name: true } } as const;
  assert.deepEqual(await read(query), { rows: [{ name: "Ana Pop" }] });
  const match = (read.inspect(query).pipeline[0] as { $match: object }).$match;
  assert.deepEqual(match, {
    $and: [{ _id: { $eq: ids.ana } }, { deletedAt: { $eq: date } }],
    $expr: {
      $and: [
        { $eq: [{ $ifNull: ["$_id", null] }, { $literal: ids.ana }] },
        { $eq: [{ $ifNull: ["$deletedAt", null] }, { $literal: date }] },
      ],
    },
  });
});

test("backend Boolean expressions lower necessary ANDs and complete ORs without negating approximations", async () => {
  const cases = [
    {
      source: mongo.from(Categories, {
        scope: (e) =>
          e.and(
            e.eq(e.field("tenant"), "demo"),
            e.startsWith(e.field("name"), "B"),
          ),
      }),
      keys: ["tenant", "$expr"],
      slugs: ["books"],
    },
    {
      source: mongo.from(Categories, {
        scope: (e) =>
          e.or(
            e.eq(e.field("name"), "Art"),
            e.startsWith(e.field("name"), "B"),
          ),
      }),
      keys: ["$expr"],
      slugs: ["art", "books"],
    },
    {
      source: mongo.from(Categories, {
        scope: (e) =>
          e.or(e.eq(e.field("name"), "Art"), e.eq(e.field("name"), "Books")),
      }),
      keys: ["$or", "$expr"],
      slugs: ["art", "books"],
    },
    {
      source: mongo.from(Categories, {
        scope: (e) => e.not(e.eq(e.field("tenant"), "demo")),
      }),
      keys: ["$expr"],
      slugs: ["hidden"],
    },
  ];
  for (const { source, keys, slugs } of cases) {
    const read = defineRead(Slug, { source });
    const query = { select: { slug: true }, orderBy: { slug: "asc" } } as const;
    const match = (read.inspect(query).pipeline[0] as { $match: object })
      .$match;
    assert.deepEqual(Object.keys(match), keys);
    assert.deepEqual(
      (await read(query)).rows.map((row) => row.slug),
      slugs,
    );
  }
});

test("custom native conditions and backend where expose index matches through the same API", async () => {
  const source = scoped().where((e) => e.gte(e.field("subtotal"), 20));
  const Resource = defineResource(
    { slug: field.string().orderable() },
    { predicates: { named: field.string().filterable("$eq") } },
  );
  const read = defineRead(Resource, {
    source,
    filters: {
      named: {
        $eq: (value) => source.condition((e) => e.eq(e.field("name"), value)),
      },
    },
  });
  const query = {
    select: { slug: true },
    where: { named: { $eq: "Books" } },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  assert.ok(matchAt(pipeline, "subtotal") >= 0);
  assert.ok(matchAt(pipeline, "name") >= 0);
  assert.deepEqual(await read(query), { rows: [{ slug: "books" }] });
});

test("unannotated and computed expressions retain their existing exact fallback", async () => {
  for (const source of [
    mongo.from(Categories, {
      scope: (e) => e.eq(e.lower(e.field("name")), "books"),
    }),
    mongo.from(Categories, {
      scope: () =>
        new MongoExpression(
          { $eq: ["$name", { $literal: "Books" }] },
          new Set(["name"]),
          (row) => row.name === "Books",
          schema.boolean(),
        ),
    }),
  ]) {
    const read = defineRead(Slug, { source });
    const query = { select: { slug: true } } as const;
    assert.deepEqual(
      Object.keys(
        (read.inspect(query).pipeline[0] as { $match: object }).$match,
      ),
      ["$expr"],
    );
    assert.deepEqual(await read(query), { rows: [{ slug: "books" }] });
  }
});

test("frontend index filters wait for overwritten values and global native computations", async () => {
  const source = scoped()
    .derive("name", (e) => e.upper(e.field("name")))
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
    });
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      total: field.number(),
    }),
    { source },
  );
  const query = {
    select: { name: true, total: true },
    where: { name: { $eq: "BOOKS" } },
  } as const;
  const pipeline = read.inspect(query).pipeline;
  assert.ok(
    matchAt(pipeline, "name") >
      pipeline.findIndex((stage) => "$setWindowFields" in (stage as object)),
  );
  assert.deepEqual(await read(query), {
    rows: [{ name: "BOOKS", total: 100 }],
  });
});
