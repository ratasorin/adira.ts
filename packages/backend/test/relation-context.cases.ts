/** Loaded by read.test.ts to share its private database lifecycle. */
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  defineResource,
  field,
  schema,
  ReadValidationError,
} from "@n/adira.core.ts";
import { defineRead, mongo, ReadBudgetError } from "../read";
import {
  Categories,
  Products,
  categorySource,
  creatorSource,
  productSource,
  CreatorResource,
  ids,
} from "./fixtures";

const ProductView = defineResource({
  name: field.string(),
  stock: field.number().filterable("$gte").orderable(),
});
const Stock = defineResource({ stock: field.number() });
const Name = field.string().filterable("$in").orderable();
const join = { localField: "_id", foreignField: "category" } as const;
const where = { name: { $in: ["Books", "Games"] } } as const;
const output = schema.object({ name: schema.string(), stock: schema.number() });

function parents(deferred: boolean) {
  return deferred ? categorySource.filter(() => true) : categorySource;
}

test("relation-first application mapping can remove or replace every join field", async () => {
  const Label = defineResource({ label: field.string() });
  for (const deferred of [false, true]) {
    const source = parents(deferred);
    const creators = source
      .related(creatorSource, {
        localField: "createdBy",
        foreignField: "_id",
      })
      .map(({ name }) => ({ label: `Author: ${name}` }));
    const read = defineRead(
      defineResource({ name: Name, creator: field.one(Label).nullable() }),
      {
        source,
        relations: { creator: creators.one(Label) },
      },
    );
    const query = {
      select: { name: true, creator: { select: { label: true } } },
      where,
      orderBy: { name: "asc" },
    } as const;
    assert.equal(
      read.inspect(query).relationStrategies.creator,
      deferred ? "batched-lookup" : "lookup",
    );
    assert.deepEqual(await read(query), {
      rows: [
        { name: "Books", creator: { label: "Author: Dan Ionescu" } },
        { name: "Games", creator: null },
      ],
    });
  }
});

test("identity maps and batch transforms remain valid relation implementations", async () => {
  for (const batch of [false, true]) {
    const related = categorySource.related(productSource, join).toApp();
    const child = batch
      ? related.transformBatch((rows) => [...rows])
      : related.map((row) => ({ ...row }));
    const read = defineRead(
      defineResource({ name: Name, products: field.many(ProductView) }),
      {
        source: categorySource,
        relations: { products: child.many(ProductView) },
      },
    );
    assert.deepEqual(
      await read({
        select: {
          name: true,
          products: {
            select: { name: true },
            orderBy: { stock: "desc" },
            page: { limit: 1 },
          },
        },
        where,
        orderBy: { name: "asc" },
      }),
      {
        rows: [
          { name: "Books", products: [{ name: "Book B" }] },
          { name: "Games", products: [{ name: "Game" }] },
        ],
      },
    );
  }
});

test("reusable scoped fragments preserve their parent and source context", async () => {
  const first = categorySource.related(productSource, join);
  const second = categorySource.related(productSource, join);
  assert.throws(() => first.use(() => second), /parent context/);
  assert.throws(
    () => first.toApp().use(() => second.toApp()),
    /parent context/,
  );
  const projected = first.use((plan) => plan.project(["name", "stock"]));
  const read = defineRead(
    defineResource({ name: Name, products: field.many(ProductView) }),
    {
      source: categorySource,
      relations: { products: projected.many(ProductView) },
    },
  );
  assert.deepEqual(
    await read({
      select: { products: { select: { name: true } } },
      where: { name: { $in: ["Games"] } },
    }),
    {
      rows: [{ products: [{ name: "Game" }] }],
    },
  );
});

test("native projection and join-key rewriting cannot reroute a relation payload", async () => {
  for (const deferred of [false, true]) {
    const source = parents(deferred);
    const child = source.related(productSource, join).native({
      stages: [
        { $set: { category: ids.games } },
        { $project: { _id: 0, name: 1, stock: 1 } },
      ],
      output,
    });
    const read = defineRead(
      defineResource({ name: Name, products: field.many(ProductView) }),
      {
        source,
        relations: { products: child.many(ProductView) },
      },
    );
    assert.deepEqual(
      await read({
        select: {
          name: true,
          products: {
            select: { name: true, stock: true },
            orderBy: { stock: "asc" },
          },
        },
        where,
        orderBy: { name: "asc" },
      }),
      {
        rows: [
          {
            name: "Books",
            products: [
              { name: "Book A", stock: 3 },
              { name: "Book B", stock: 7 },
            ],
          },
          { name: "Games", products: [{ name: "Game", stock: 10 }] },
        ],
      },
    );
  }
});

test("raw native limits select one child per parent in direct and deferred execution", async () => {
  for (const deferred of [false, true]) {
    const source = parents(deferred);
    const child = source.related(productSource, join).native({
      stages: [
        { $sort: { stock: -1, name: 1 } },
        { $limit: 1 },
        { $project: { _id: 0, name: 1, stock: 1 } },
      ],
      output,
    });
    const read = defineRead(
      defineResource({ name: Name, products: field.many(ProductView) }),
      {
        source,
        relations: { products: child.many(ProductView) },
      },
    );
    const query = {
      select: { name: true, products: { select: { name: true } } },
      where,
      orderBy: { name: "asc" },
    } as const;
    assert.equal(
      read.inspect(query).relationStrategies.products,
      deferred ? "batched-lookup" : "lookup",
    );
    assert.deepEqual(await read(query), {
      rows: [
        { name: "Books", products: [{ name: "Book B" }] },
        { name: "Games", products: [{ name: "Game" }] },
      ],
    });
  }
});

test("native grouping and application batch reductions receive only one parent's rows", async () => {
  for (const deferred of [false, true]) {
    for (const application of [false, true]) {
      const source = parents(deferred);
      const related = source.related(productSource, join);
      const child = application
        ? related
            .toApp({ batchSize: 128 })
            .transformBatch((rows) => [
              { stock: rows.reduce((sum, row) => sum + row.stock, 0) },
            ])
            .one(Stock)
        : related
            .native({
              stages: [{ $group: { _id: null, stock: { $sum: "$stock" } } }],
              output: schema.object({ stock: schema.number() }),
            })
            .one(Stock);
      const read = defineRead(
        defineResource({ name: Name, summary: field.one(Stock).nullable() }),
        {
          source,
          relations: { summary: child },
        },
      );
      assert.deepEqual(
        await read({
          select: { name: true, summary: { select: { stock: true } } },
          where: { name: { $in: ["Art", "Books", "Games"] } },
          orderBy: { name: "asc" },
        }),
        {
          rows: [
            { name: "Art", summary: null },
            { name: "Books", summary: { stock: 10 } },
            { name: "Games", summary: { stock: 10 } },
          ],
        },
      );
    }
  }
});

test("window calculations retain per-parent ranks even when all rows and keys survive", async () => {
  const Ranked = defineResource({
    name: field.string(),
    rank: field.number().orderable(),
  });
  for (const deferred of [false, true]) {
    const source = parents(deferred);
    const child = source.related(productSource, join).native({
      stages: [
        {
          $setWindowFields: {
            sortBy: { stock: -1 },
            output: { rank: { $rank: {} } },
          },
        },
        { $project: { _id: 0, name: 1, rank: 1 } },
      ],
      output: schema.object({ name: schema.string(), rank: schema.number() }),
    });
    const read = defineRead(
      defineResource({ name: Name, products: field.many(Ranked) }),
      { source, relations: { products: child.many(Ranked) } },
    );
    assert.deepEqual(
      await read({
        select: {
          name: true,
          products: {
            select: { name: true, rank: true },
            orderBy: { rank: "asc" },
          },
        },
        where,
        orderBy: { name: "asc" },
      }),
      {
        rows: [
          {
            name: "Books",
            products: [
              { name: "Book B", rank: 1 },
              { name: "Book A", rank: 2 },
            ],
          },
          { name: "Games", products: [{ name: "Game", rank: 1 }] },
        ],
      },
    );
  }
});

test("array joins and overlapping parents aggregate each matching child once", async () => {
  const id = schema.custom<mongoose.Types.ObjectId | null>((value) => {
    if (value === null || value instanceof mongoose.Types.ObjectId)
      return value;
    throw new Error("Expected nullable ObjectId");
  });
  const native = mongo.from(Categories).native({
    stages: [
      {
        $project: {
          name: 1,
          keys: {
            $cond: [
              { $eq: ["$name", "Books"] },
              [ids.books, ids.games, ids.books, null],
              [ids.games],
            ],
          },
        },
      },
    ],
    output: schema.object({ name: schema.string(), keys: schema.array(id) }),
  });
  for (const deferred of [false, true]) {
    const source = deferred ? native.toApp().filter(() => true) : native;
    const child = source
      .related(productSource, { localField: "keys", foreignField: "category" })
      .native({
        stages: [{ $group: { _id: null, stock: { $sum: "$stock" } } }],
        output: schema.object({ stock: schema.number() }),
      });
    const read = defineRead(
      defineResource({ name: Name, summary: field.one(Stock) }),
      { source, relations: { summary: child.one(Stock) } },
    );
    assert.deepEqual(
      await read({
        select: { name: true, summary: { select: { stock: true } } },
        where,
        orderBy: { name: "asc" },
      }),
      {
        rows: [
          { name: "Books", summary: { stock: 20 } },
          { name: "Games", summary: { stock: 10 } },
        ],
      },
    );
  }
});

test("source policies run before aggregation at roots and within relations", async () => {
  const scoped = mongo.from(Products, {
    scope: (e, context) =>
      e.and(
        e.eq(e.field("isActive"), true),
        e.gte(e.field("stock"), (context as { minimum: number }).minimum),
      ),
  });
  const aggregate = {
    stages: [{ $group: { _id: null, stock: { $sum: "$stock" } } }],
    output: schema.object({ stock: schema.number() }),
  } as const;
  const root = defineRead(Stock, { source: scoped.native(aggregate) });
  assert.deepEqual(await root({ select: { stock: true } }, { minimum: 4 }), {
    rows: [{ stock: 7 }],
  });
  for (const deferred of [false, true]) {
    const source = parents(deferred);
    const summary = source.related(scoped, join).native(aggregate).one(Stock);
    const read = defineRead(
      defineResource({ name: Name, summary: field.one(Stock).nullable() }),
      { source, relations: { summary } },
    );
    assert.deepEqual(
      await read(
        {
          select: { name: true, summary: { select: { stock: true } } },
          where,
          orderBy: { name: "asc" },
        },
        { minimum: 4 },
      ),
      {
        rows: [
          { name: "Books", summary: { stock: 7 } },
          { name: "Games", summary: null },
        ],
      },
    );
  }
});

test("relation-dependent computed fields preserve raw pipeline scope in native and application fallback", async () => {
  for (const application of [false, true]) {
    const related = categorySource.related(productSource, join).native({
      stages: [
        { $sort: { stock: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, name: 1, stock: 1 } },
      ],
      output,
    });
    const binding = application
      ? related
          .toApp()
          .filter(() => true)
          .many(ProductView)
      : related.many(ProductView);
    const source = categorySource.load(
      "stock",
      binding.sum({ field: "stock" }),
    );
    const read = defineRead(
      defineResource({
        name: Name,
        stock: field.number().filterable("$gte").orderable(),
      }),
      { source },
    );
    const query = {
      select: { name: true, stock: true },
      where: { $and: [where, { stock: { $gte: 7 } }] },
      orderBy: { stock: "desc" },
      page: { limit: 2 },
    } as const;
    assert.equal(
      read.inspect(query).dependencies.stock.strategy,
      application ? "application" : "mongodb",
    );
    assert.deepEqual(await read(query), {
      rows: [
        { name: "Games", stock: 10 },
        { name: "Books", stock: 7 },
      ],
    });
  }
});

test("nested dependencies load before a mapper discards private inputs", async () => {
  const View = defineResource({ name: field.string(), author: field.string() });
  const related = categorySource
    .related(productSource, join)
    .derive("creatorId", (e) => e.literal(ids.ana));
  const creator = related
    .related(creatorSource, { localField: "creatorId", foreignField: "_id" })
    .one(CreatorResource);
  const child = related
    .toApp()
    .load("creator", creator.get({ select: { name: true } }))
    .map(({ name, creator }) => ({ name, author: creator?.name ?? "Unknown" }))
    .many(View);
  const read = defineRead(
    defineResource({ name: Name, products: field.many(View) }),
    { source: categorySource, relations: { products: child } },
  );
  assert.deepEqual(
    await read({
      select: { products: { select: { name: true, author: true } } },
      where: { name: { $in: ["Books"] } },
    }),
    {
      rows: [
        {
          products: [
            { name: "Book A", author: "Ana Pop" },
            { name: "Book B", author: "Ana Pop" },
          ],
        },
      ],
    },
  );
});

test("parent-scoped relation transformations retain cardinality and candidate validation", async () => {
  const related = categorySource
    .related(productSource, join)
    .project(["name", "stock"]);
  const invalid = defineRead(
    defineResource({ name: Name, products: field.one(ProductView) }),
    {
      source: categorySource,
      relations: { products: related.one(ProductView) },
    },
  );
  await assert.rejects(
    invalid({
      select: { products: { select: { name: true } } },
      where: { name: { $in: ["Books"] } },
    }),
    /returned multiple rows/,
  );
  await assert.rejects(
    invalid({
      select: { products: { select: { name: true } } },
      where: { name: { $in: ["Art"] } },
    }),
    ReadValidationError,
  );
  const child = related
    .toApp()
    .filter(() => true)
    .many(ProductView, { limits: { maxCandidates: 1 } });
  const limited = defineRead(
    defineResource({ name: Name, products: field.many(ProductView) }),
    { source: categorySource, relations: { products: child } },
  );
  await assert.rejects(
    limited({
      select: { products: { select: { name: true } } },
      where: { name: { $in: ["Books"] } },
    }),
    ReadBudgetError,
  );
});

test("custom native pipelines handle empty collections without fabricated source documents", async () => {
  await Products.deleteMany({});
  for (const deferred of [false, true]) {
    const source = parents(deferred);
    const summary = source
      .related(productSource, join)
      .native({
        stages: [
          { $facet: { items: [{ $project: { _id: 1 } }] } },
          { $project: { _id: 0, stock: { $size: "$items" } } },
        ],
        output: schema.object({ stock: schema.number() }),
      })
      .one(Stock);
    const read = defineRead(
      defineResource({ name: Name, summary: field.one(Stock) }),
      { source, relations: { summary } },
    );
    assert.deepEqual(
      await read({
        select: { name: true, summary: { select: { stock: true } } },
        where,
        orderBy: { name: "asc" },
      }),
      {
        rows: [
          { name: "Books", summary: { stock: 0 } },
          { name: "Games", summary: { stock: 0 } },
        ],
      },
    );
  }
});

test("missing, empty, and null join keys remain empty even when a native fragment emits defaults", async () => {
  const native = mongo.from(Categories).native({
    stages: [
      {
        $project: {
          name: 1,
          keys: {
            $switch: {
              branches: [
                { case: { $eq: ["$name", "Books"] }, then: [] },
                { case: { $eq: ["$name", "Games"] }, then: [null] },
              ],
              default: null,
            },
          },
        },
      },
    ],
    output: schema.object({
      name: schema.string(),
      keys: schema.nullable(
        schema.array(
          schema.nullable(
            schema.custom<mongoose.Types.ObjectId>((value) => {
              if (!(value instanceof mongoose.Types.ObjectId))
                throw new Error("Expected ObjectId");
              return value;
            }),
          ),
        ),
      ),
    }),
  });
  for (const deferred of [false, true]) {
    const source = deferred ? native.toApp().filter(() => true) : native;
    const summary = source
      .related(productSource, { localField: "keys", foreignField: "category" })
      .native({
        stages: [
          { $facet: { items: [] } },
          { $project: { stock: { $literal: 0 } } },
        ],
        output: schema.object({ stock: schema.number() }),
      })
      .one(Stock);
    const read = defineRead(
      defineResource({ name: Name, summary: field.one(Stock).nullable() }),
      { source, relations: { summary } },
    );
    assert.deepEqual(
      await read({
        select: { name: true, summary: { select: { stock: true } } },
        where,
        orderBy: { name: "asc" },
      }),
      {
        rows: [
          { name: "Books", summary: null },
          { name: "Games", summary: null },
        ],
      },
    );
  }
});
