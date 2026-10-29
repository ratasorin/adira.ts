/** Loaded by read.test.ts to share its isolated MongoDB lifecycle and seed hooks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defineResource,
  field,
  ReadValidationError,
  schema,
} from "@n/adira.core.ts";
import { defineRead, mongo, MongoExpression } from "../read";
import { Categories, Products } from "./fixtures";

// An unused field must be absent from the actual pipeline, not just its response.
const poison = () =>
  new MongoExpression<number>(
    { $divide: [1, 0] },
    new Set(),
    () => {
      throw new Error("poison evaluated");
    },
    schema.number(),
  );

const Name = defineResource({ name: field.string().filterable("$eq") });
const Amount = defineResource({
  name: field.string().filterable("$eq"),
  total: field.number().filterable("$gte").orderable(),
});
const books = { name: { $eq: "Books" } } as const;

function writes(pipeline: readonly unknown[], key: string): boolean {
  return pipeline.some((stage) => {
    const set = (stage as { $set?: Record<string, unknown> }).$set;
    return set !== undefined && Object.prototype.hasOwnProperty.call(set, key);
  });
}

test("unused native derivations are neither executed nor validated", async () => {
  const source = mongo.from(Categories).derive("broken", poison);
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      broken: field.number(),
    }),
    { source },
  );
  assert.equal(
    writes(read.inspect({ select: { name: true } }).pipeline, "broken"),
    false,
  );
  assert.deepEqual(await read({ select: { name: true }, where: books }), {
    rows: [{ name: "Books" }],
  });
  await assert.rejects(
    read({ select: { broken: true }, where: books }),
    /divide by zero/i,
  );
  // Inspection and execution do not mutate the reusable source.
  assert.equal(
    writes(read.inspect({ select: { name: true } }).pipeline, "broken"),
    false,
  );

  let validations = 0;
  const checked = mongo.from(Categories).derive(
    "checked",
    () =>
      new MongoExpression(
        { $literal: 7 },
        new Set(),
        () => 7,
        schema.custom<number>(() => {
          validations++;
          throw new ReadValidationError("bad derived value");
        }),
      ),
  );
  const validate = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      checked: field.number(),
    }),
    { source: checked },
  );
  await validate({ select: { name: true }, where: books });
  assert.equal(validations, 0);
  await assert.rejects(
    validate({ select: { checked: true }, where: books }),
    /bad derived value/,
  );
  assert.equal(validations, 1);
});

test("native pruning follows transitive dependencies through projections and app derivations", async () => {
  const source = mongo
    .from(Categories)
    .derive("broken", poison)
    .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")))
    .derive("doubled", (e) => e.multiply(e.field("total"), e.literal(2)))
    .project(["name", "broken", "doubled"])
    .toApp()
    .derive("label", ["doubled"], ({ doubled }) => `Total ${doubled}`);
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      label: field.string(),
    }),
    { source },
  );
  const plan = read.inspect({ select: { label: true }, where: books });
  assert.equal(writes(plan.pipeline, "total"), true);
  assert.equal(writes(plan.pipeline, "doubled"), true);
  assert.equal(writes(plan.pipeline, "broken"), false);
  assert.deepEqual(await read({ select: { label: true }, where: books }), {
    rows: [{ label: "Total 72" }],
  });
  assert.equal(
    writes(read.inspect({ select: { name: true } }).pipeline, "total"),
    false,
  );
});

test("unselected native fields remain available for frontend filters, ordering, default order, and scope", async () => {
  const source = mongo
    .from(Categories)
    .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")));
  const read = defineRead(Amount, { source });
  for (const query of [
    { select: { name: true }, where: { total: { $gte: 100 } } },
    { select: { name: true }, orderBy: { total: "desc" }, page: { limit: 1 } },
  ] as const) {
    assert.equal(writes(read.inspect(query).pipeline, "total"), true);
    assert.deepEqual(await read(query), { rows: [{ name: "Alien" }] });
  }
  const scoped = defineRead(Amount, {
    source,
    scope: () => source.condition((e) => e.gte(e.field("total"), 100)),
  });
  assert.deepEqual(await scoped({ select: { name: true } }), {
    rows: [{ name: "Alien" }],
  });
  const ordered = defineRead(Amount, {
    source,
    defaultOrderBy: { total: "desc" },
  });
  assert.deepEqual(
    await ordered({ select: { name: true }, page: { limit: 1 } }),
    { rows: [{ name: "Alien" }] },
  );

  const appFilter = defineRead(Amount, {
    source,
    filters: {
      total: {
        $gte: (expected) =>
          source.appCondition({
            requires: ["total"],
            evaluate: ({ total }) => total >= expected,
          }),
      },
    },
  });
  assert.deepEqual(
    await appFilter({
      select: { name: true },
      where: { total: { $gte: 100 } },
    }),
    { rows: [{ name: "Alien" }] },
  );
});

test("source filters and ordering retain their native inputs even when projected away", async () => {
  const source = mongo
    .from(Categories)
    .derive("broken", poison)
    .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")))
    .where((e) => e.gte(e.field("total"), 36))
    .sortBy({ total: -1 })
    .project(["name"]);
  const read = defineRead(Name, { source });
  const plan = read.inspect({ select: { name: true } });
  assert.equal(writes(plan.pipeline, "total"), true);
  assert.equal(writes(plan.pipeline, "broken"), false);
  assert.deepEqual(await read({ select: { name: true }, page: { limit: 2 } }), {
    rows: [{ name: "Alien" }, { name: "Audio" }],
  });
});

test("native pruning distinguishes overwritten field versions and self-dependencies", async () => {
  const replaced = mongo
    .from(Categories)
    .derive("total", poison)
    .derive("total", (e) => e.literal(7));
  assert.deepEqual(
    await defineRead(Amount, { source: replaced })({
      select: { total: true },
      where: books,
    }),
    { rows: [{ total: 7 }] },
  );
  const incremented = replaced.derive("total", (e) =>
    e.add(e.field("total"), e.literal(1)),
  );
  assert.deepEqual(
    await defineRead(Amount, { source: incremented })({
      select: { total: true },
      where: books,
    }),
    { rows: [{ total: 8 }] },
  );
  const consumedBeforeOverwrite = mongo
    .from(Categories)
    .derive("total", (e) => e.literal(7))
    .where((e) => e.eq(e.field("total"), 7))
    .derive("total", poison);
  const membership = defineRead(Amount, { source: consumedBeforeOverwrite });
  assert.deepEqual(await membership({ select: { name: true }, where: books }), {
    rows: [{ name: "Books" }],
  });
  const overwrittenInApp = mongo
    .from(Categories)
    .derive("total", poison)
    .toApp()
    .derive("total", [], () => 99);
  const read = defineRead(Amount, { source: overwrittenInApp });
  assert.equal(
    writes(read.inspect({ select: { total: true } }).pipeline, "total"),
    false,
  );
  assert.deepEqual(await read({ select: { total: true }, where: books }), {
    rows: [{ total: 99 }],
  });
});

test("opaque application callbacks retain every native field they can observe", async () => {
  const base = mongo
    .from(Categories)
    .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")))
    .toApp();
  for (const source of [
    base.map((row) => ({ ...row, name: String(row.total) })),
    base.filter((row) => row.total >= 100),
    base.transformBatch((rows) =>
      rows.map((row) => ({ ...row, name: String(row.total) })),
    ),
  ]) {
    const read = defineRead(Name, { source });
    assert.equal(
      writes(read.inspect({ select: { name: true } }).pipeline, "total"),
      true,
    );
    const result = await read({ select: { name: true } });
    assert.ok(
      result.rows.some(({ name }) => name === "120" || name === "Alien"),
    );
  }
});

test("raw native blocks retain their complete input and declared output validation", async () => {
  const source = mongo
    .from(Categories)
    .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")))
    .native({
      stages: [{ $match: { $expr: { $gte: ["$total", 100] } } }],
      output: schema.object({ name: schema.string() }),
    })
    .derive("broken", poison);
  const read = defineRead(Name, { source });
  const plan = read.inspect({ select: { name: true } });
  assert.equal(writes(plan.pipeline, "total"), true);
  assert.equal(writes(plan.pipeline, "broken"), false);
  assert.deepEqual(await read({ select: { name: true } }), {
    rows: [{ name: "Alien" }],
  });
  const invalid = source.native({
    stages: [],
    output: schema.object({ name: schema.string(), absent: schema.number() }),
  });
  await assert.rejects(
    defineRead(Name, { source: invalid })({ select: { name: true } }),
    ReadValidationError,
  );
});

test("a projection before a raw block bounds the fields that block can observe", async () => {
  const source = mongo
    .from(Categories)
    .derive("broken", poison)
    .project(["name"])
    .native({
      stages: [{ $replaceWith: "$$ROOT" }],
      output: schema.object({ name: schema.string() }),
    });
  const read = defineRead(Name, { source });
  assert.equal(
    writes(read.inspect({ select: { name: true } }).pipeline, "broken"),
    false,
  );
  assert.deepEqual(await read({ select: { name: true }, where: books }), {
    rows: [{ name: "Books" }],
  });
});

test("native relation computations are pruned in both lookup and deferred strategies", async () => {
  for (const deferred of [false, true]) {
    const native = mongo
      .from(Categories)
      .derive("joinKey", (e) => e.field("_id"));
    const parent = deferred ? native.toApp().filter(() => true) : native;
    const child = mongo.from(Products).derive("broken", poison);
    const products = parent
      .related(child, { localField: "joinKey", foreignField: "category" })
      .many(Name);
    const read = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        products: field.many(Name),
      }),
      { source: parent, relations: { products } },
    );
    const query = {
      select: { name: true, products: { select: { name: true } } },
      where: books,
    } as const;
    const plan = read.inspect(query);
    assert.equal(writes(plan.pipeline, "joinKey"), true);
    assert.equal(writes(plan.relations.products.pipeline, "broken"), false);
    assert.equal(
      plan.relationStrategies.products,
      deferred ? "batched-lookup" : "lookup",
    );
    const result = await read(query);
    assert.equal(result.rows[0].name, "Books");
    assert.deepEqual(result.rows[0].products.map(({ name }) => name).sort(), [
      "Book A",
      "Book B",
    ]);
  }
});

test("native relation aggregates prune unrelated computations and retain their aggregate inputs", async () => {
  const parent = mongo.from(Categories);
  const child = mongo
    .from(Products)
    .derive("broken", poison)
    .derive("score", (e) => e.multiply(e.field("stock"), e.literal(2)));
  const Item = defineResource({
    score: field.number(),
    broken: field.number(),
  });
  const products = parent
    .related(child, { localField: "_id", foreignField: "category" })
    .many(Item);
  const source = parent
    .toApp()
    .load("count", products.count())
    .load("score", products.sum({ field: "score" }));
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      count: field.number(),
      score: field.number(),
    }),
    { source },
  );
  const query = { select: { count: true, score: true }, where: books } as const;
  const plan = read.inspect(query);
  assert.equal(plan.dependencies.count.strategy, "mongodb");
  assert.equal(plan.dependencies.score.strategy, "mongodb");
  assert.equal(writes(plan.dependencies.count.pipeline, "score"), false);
  assert.equal(writes(plan.dependencies.score.pipeline, "score"), true);
  assert.equal(writes(plan.dependencies.score.pipeline, "broken"), false);
  assert.deepEqual(await read(query), { rows: [{ count: 2, score: 20 }] });
});

test("custom loaders retain their declared native parent dependencies", async () => {
  const source = mongo
    .from(Categories)
    .derive("label", (e) => e.upper(e.field("name")))
    .derive("broken", poison);
  const Value = defineResource({ value: field.string() });
  const value = source
    .related({
      requires: ["label"],
      output: schema.object({ value: schema.string() }),
      resolveBatch: ({ parents }) =>
        parents.map(({ ref, row }) => ({ ref, rows: [{ value: row.label }] })),
    })
    .one(Value);
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      value: field.one(Value),
    }),
    { source, relations: { value } },
  );
  const query = {
    select: { value: { select: { value: true } } },
    where: books,
  } as const;
  assert.equal(writes(read.inspect(query).pipeline, "label"), true);
  assert.equal(writes(read.inspect(query).pipeline, "broken"), false);
  assert.deepEqual(await read(query), {
    rows: [{ value: { value: "BOOKS" } }],
  });
});
