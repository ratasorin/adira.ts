/** Loaded by read.test.ts to share its temporary MongoDB lifecycle. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import {
  defineResource,
  field,
  schema,
  ReadValidationError,
} from "@n/adira.core.ts";
import {
  defineRead,
  mongo,
  ReadBudgetError,
  type BatchParentRef,
} from "../read";
import {
  categorySource,
  Categories,
  Products,
  ids,
  productSource,
} from "./fixtures";

const Item = defineResource({
  label: field.string().filterable("$eq", "$startsWith").orderable(),
  amount: field.number().filterable("$gte", "$lt").orderable(),
});
const output = schema.object({
  label: schema.string(),
  amount: schema.number(),
});
const Name = field.string().filterable("$in").orderable();
const where = { name: { $in: ["Books", "Games"] } } as const;

function reader(options: {
  resolveBatch: (input: {
    parents: readonly {
      ref: BatchParentRef;
      row: Readonly<{ name: string }>;
    }[];
    context: unknown;
  }) => any;
  batchSize?: number;
  maxCandidates?: number;
}) {
  const plan = categorySource.related({
    requires: ["name"],
    output,
    ...options,
  });
  const items = plan.many(Item, {
    limits: { maxCandidates: options.maxCandidates ?? 100 },
  });
  const read = defineRead(
    defineResource({ name: Name, items: field.many(Item) }),
    {
      source: categorySource,
      relations: { items },
    },
  );
  return { read, plan, items };
}

test("resolveBatch shares work across parents, accepts reordered results, and receives only declared fields", async () => {
  let calls = 0,
    computations = 0;
  const source = categorySource.related({
    requires: ["tenant"],
    output,
    batchSize: 100,
    resolveBatch: async ({ parents, context }) => {
      calls++;
      assert.equal(context, "request-context");
      assert.deepEqual(
        parents.map(({ row }) => Object.keys(row)),
        [["tenant"], ["tenant"]],
      );
      const totals = new Map(
        [...new Set(parents.map(({ row }) => row.tenant))].map((tenant) => {
          computations++;
          return [tenant, 42] as const;
        }),
      );
      return [...parents].reverse().map(({ ref, row }) => ({
        ref,
        rows: [{ label: row.tenant, amount: totals.get(row.tenant)! }],
      }));
    },
  });
  const read = defineRead(
    defineResource({ name: Name, items: field.many(Item) }),
    {
      source: categorySource,
      relations: { items: source.many(Item) },
    },
  );
  const query = {
    select: { name: true, items: { select: { amount: true } } },
    where,
    orderBy: { name: "asc" },
  } as const;
  assert.equal(read.inspect(query).relationStrategies.items, "resolveBatch");
  assert.deepEqual(read.inspect(query).relations.items.pipeline, []);
  assert.deepEqual(await read(query, "request-context"), {
    rows: [
      { name: "Books", items: [{ amount: 42 }] },
      { name: "Games", items: [{ amount: 42 }] },
    ],
  });
  assert.equal(calls, 1);
  assert.equal(computations, 1);
});

test("resolveBatch applies Boolean filters, ordering, pagination and projection after candidate loading", async () => {
  const { read } = reader({
    resolveBatch: ({ parents }) =>
      parents.map(({ ref }) => ({
        ref,
        rows: [
          { label: "low", amount: 1 },
          { label: "high", amount: 9 },
          { label: "middle", amount: 5 },
        ],
      })),
  });
  assert.deepEqual(
    await read({
      select: {
        name: true,
        items: {
          select: { label: true },
          where: {
            $and: [
              { $or: [{ amount: { $gte: 5 } }, { label: { $eq: "low" } }] },
              { $not: { amount: { $lt: 5 } } },
            ],
          },
          orderBy: { amount: "desc" },
          page: { offset: 1, limit: 1 },
        },
      },
      where,
      orderBy: { name: "asc" },
    }),
    {
      rows: [
        { name: "Books", items: [{ label: "middle" }] },
        { name: "Games", items: [{ label: "middle" }] },
      ],
    },
  );
});

test("resolveBatch batches selected parents and does no work for unselected relations or empty parents", async () => {
  const sizes: number[] = [];
  const { read } = reader({
    batchSize: 1,
    resolveBatch: ({ parents }) => {
      sizes.push(parents.length);
      return parents.map(({ ref }) => ({ ref, rows: [] }));
    },
  });
  await read({ select: { name: true }, where });
  await read({
    select: { items: { select: { label: true } } },
    where: { name: { $in: [] } },
  });
  assert.deepEqual(sizes, []);
  await read({ select: { items: { select: { label: true } } }, where });
  assert.deepEqual(sizes, [1, 1]);
});

test("resolveBatch can perform one raw MongoDB aggregation for an entire parent batch", async () => {
  let queries = 0;
  const totals = categorySource.related({
    requires: ["_id"],
    output: schema.object({ stock: schema.number() }),
    resolveBatch: async ({ parents }) => {
      queries++;
      const rows = await Products.aggregate<{
        _id: typeof ids.books;
        stock: number;
      }>([
        { $match: { category: { $in: parents.map(({ row }) => row._id) } } },
        { $group: { _id: "$category", stock: { $sum: "$stock" } } },
      ]);
      const byId = new Map(
        rows.map((row) => [row._id.toHexString(), row.stock]),
      );
      return parents.map(({ ref, row }) => ({
        ref,
        rows: [{ stock: byId.get(row._id.toHexString()) ?? 0 }],
      }));
    },
  });
  const Stock = defineResource({ stock: field.number() });
  const read = defineRead(
    defineResource({ name: Name, summary: field.one(Stock) }),
    {
      source: categorySource,
      relations: { summary: totals.one(Stock) },
    },
  );
  assert.deepEqual(
    await read({
      select: { name: true, summary: { select: { stock: true } } },
      where,
      orderBy: { name: "asc" },
    }),
    {
      rows: [
        { name: "Books", summary: { stock: 10 } },
        { name: "Games", summary: { stock: 10 } },
      ],
    },
  );
  assert.equal(queries, 1);
});

test("resolveBatch supports scope, custom predicates and application transforms", async () => {
  const { plan } = reader({
    resolveBatch: ({ parents }) =>
      parents.map(({ ref }) => ({
        ref,
        rows: [
          { label: "private", amount: 50 },
          { label: "public", amount: 5 },
        ],
      })),
  });
  const transformed = plan.map(({ label, amount }) => ({
    label: label.toUpperCase(),
    amount: amount * 2,
  }));
  const PublicItem = defineResource(
    { label: field.string(), amount: field.number() },
    {
      predicates: { enough: field.boolean().filterable("$eq") },
    },
  );
  const items = transformed.many(PublicItem, {
    scope: () =>
      transformed.appCondition({
        requires: ["label"],
        evaluate: ({ label }) => label === "PUBLIC",
      }),
    filters: {
      enough: {
        $eq: (expected) =>
          transformed.appCondition({
            requires: ["amount"],
            evaluate: ({ amount }) => amount >= 10 === expected,
          }),
      },
    },
  });
  const read = defineRead(defineResource({ items: field.many(PublicItem) }), {
    source: categorySource,
    relations: { items },
  });
  assert.deepEqual(
    await read({
      select: {
        items: { select: { amount: true }, where: { enough: { $eq: true } } },
      },
      page: { limit: 1 },
    }),
    {
      rows: [{ items: [{ amount: 10 }] }],
    },
  );
});

test("resolveBatch dependency inputs are retained through MongoDB projection and can filter/order parents", async () => {
  const parent = mongo.from(Categories).project(["name", "subtotal"]).toApp();
  const values = parent
    .related({
      requires: ["subtotal"],
      output,
      resolveBatch: ({ parents }) =>
        parents.map(({ ref, row }) => ({
          ref,
          rows: [{ label: "value", amount: row.subtotal }],
        })),
    })
    .many(Item);
  const source = parent.load("total", values.sum({ field: "amount" }));
  const read = defineRead(
    defineResource({
      name: Name,
      total: field.number().filterable("$gte").orderable(),
    }),
    { source },
  );
  const query = {
    select: { name: true, total: true },
    where: { total: { $gte: 30 } },
    orderBy: { total: "desc" },
    page: { limit: 2 },
  } as const;
  assert.equal(read.inspect(query).dependencies.total.strategy, "application");
  assert.deepEqual(await read(query), {
    rows: [
      { name: "Alien", total: 100 },
      { name: "Audio", total: 40 },
    ],
  });
});

test("resolveBatch dependencies use complete candidates regardless of the display page", async () => {
  const { items } = reader({
    resolveBatch: ({ parents }) =>
      parents.map(({ ref }) => ({
        ref,
        rows: [
          { label: "a", amount: 2 },
          { label: "b", amount: 6 },
        ],
      })),
  });
  const source = categorySource
    .load("count", items.count())
    .load("sum", items.sum({ field: "amount" }))
    .load("exists", items.exists())
    .load("average", items.avg({ field: "amount" }))
    .load("minimum", items.min({ field: "amount" }))
    .load("maximum", items.max({ field: "amount" }))
    .load("allItems", items.all({ select: { label: true } }))
    .derive("allCount", ["allItems"], ({ allItems }) => allItems.length)
    .load(
      "last",
      items.last({ select: { label: true }, orderBy: { amount: "desc" } }),
    )
    .derive("lastLabel", ["last"], ({ last }) => last?.label ?? "none")
    .load(
      "first",
      items.first({ select: { label: true }, orderBy: { amount: "desc" } }),
    )
    .derive("firstLabel", ["first"], ({ first }) => first?.label ?? "none");
  const read = defineRead(
    defineResource({
      count: field.number(),
      sum: field.number(),
      exists: field.boolean(),
      average: field.number().nullable(),
      minimum: field.number().nullable(),
      maximum: field.number().nullable(),
      allCount: field.number(),
      lastLabel: field.string(),
      firstLabel: field.string(),
      items: field.many(Item),
    }),
    {
      source,
      relations: { items },
    },
  );
  assert.deepEqual(
    await read({
      select: {
        count: true,
        sum: true,
        exists: true,
        average: true,
        minimum: true,
        maximum: true,
        allCount: true,
        lastLabel: true,
        firstLabel: true,
        items: { select: { label: true }, page: { limit: 1 } },
      },
      page: { limit: 1 },
    }),
    {
      rows: [
        {
          count: 2,
          sum: 8,
          exists: true,
          average: 4,
          minimum: 2,
          maximum: 6,
          allCount: 2,
          lastLabel: "a",
          firstLabel: "b",
          items: [{ label: "a" }],
        },
      ],
    },
  );
});

test("resolveBatch parses candidates once before transformations, supports empty requires, and strips undeclared fields", async () => {
  let parses = 0;
  const candidates = categorySource
    .related({
      requires: [],
      output: schema.object({
        label: schema.custom((value) => {
          parses++;
          return schema.string().parse(value).toUpperCase();
        }),
        amount: schema.number(),
      }),
      resolveBatch: ({ parents }) => {
        assert.deepEqual(
          parents.map(({ row }) => row),
          [{}],
        );
        return parents.map(({ ref }) => ({
          ref,
          rows: [
            { label: "low", amount: 1, privateValue: 10 },
            { label: "high", amount: 9, privateValue: 20 },
          ],
        }));
      },
    })
    .map((row) => {
      assert.deepEqual(Object.keys(row), ["label", "amount"]);
      return { ...row, label: row.label + "!" };
    });
  const read = defineRead(defineResource({ items: field.many(Item) }), {
    source: categorySource,
    relations: { items: candidates.many(Item) },
  });
  assert.deepEqual(
    await read({
      select: {
        items: {
          select: { label: true },
          where: { amount: { $gte: 5 } },
          page: { limit: 1 },
        },
      },
      page: { limit: 1 },
    }),
    {
      rows: [{ items: [{ label: "HIGH!" }] }],
    },
  );
  assert.equal(parses, 2);
});

test("resolveBatch composes nested custom relations and nested MongoDB relations", async () => {
  const products = categorySource.related({
    requires: ["_id"],
    output: schema.object({
      category: schema.string(),
      label: schema.string(),
    }),
    resolveBatch: ({ parents }) =>
      parents.map(({ ref, row }) => ({
        ref,
        rows: [{ category: row._id.toHexString(), label: "outer" }],
      })),
  });
  const label = products.related({
    requires: ["label"],
    output: schema.object({ label: schema.string() }),
    resolveBatch: ({ parents }) =>
      parents.map(({ ref, row }) => ({
        ref,
        rows: [{ label: row.label + " child" }],
      })),
  });
  const Label = defineResource({ label: field.string() });
  const Inner = defineResource({
    label: field.string(),
    nested: field.one(Label),
  });
  const read = defineRead(defineResource({ items: field.many(Inner) }), {
    source: categorySource,
    relations: {
      items: products.many(Inner, { relations: { nested: label.one(Label) } }),
    },
  });
  assert.deepEqual(
    await read({
      select: { items: { select: { nested: { select: { label: true } } } } },
      page: { limit: 1 },
    }),
    {
      rows: [{ items: [{ nested: { label: "outer child" } }] }],
    },
  );
  // Establish the nested join against the original ObjectId, then transform children.
  const parentIds = categorySource.related({
    requires: ["_id"],
    output: schema.object({
      category: schema.custom((value: unknown) => {
        if (!(value instanceof Types.ObjectId))
          throw new Error("Expected ObjectId");
        return value;
      }),
    }),
    resolveBatch: ({ parents }) =>
      parents.map(({ ref, row }) => ({ ref, rows: [{ category: row._id }] })),
  });
  const related = parentIds
    .related(productSource, {
      localField: "category",
      foreignField: "category",
    })
    .toApp()
    .map(({ name, stock }) => ({ label: name, amount: stock }));
  const Parent = defineResource({ children: field.many(Item) });
  const readMongo = defineRead(
    defineResource({ name: Name, items: field.many(Parent) }),
    {
      source: categorySource,
      relations: {
        items: parentIds.many(Parent, {
          relations: { children: related.many(Item) },
        }),
      },
    },
  );
  assert.deepEqual(
    await readMongo({
      select: {
        items: {
          select: {
            children: {
              select: { label: true },
              orderBy: { amount: "desc" },
              page: { limit: 1 },
            },
          },
        },
      },
      where: { name: { $in: ["Books"] } },
    }),
    {
      rows: [{ items: [{ children: [{ label: "Book B" }] }] }],
    },
  );
});

for (const [name, resolveBatch, message] of [
  ["non-array results", () => null, /must return an array/],
  ["missing parents", () => [], /omitted a parent/],
  [
    "duplicate references",
    ({ parents }: any) =>
      [parents[0], parents[0]].map(({ ref }) => ({ ref, rows: [] })),
    /duplicate or unknown/,
  ],
  ["unknown references", () => [{ ref: {}, rows: [] }], /duplicate or unknown/],
  [
    "non-array rows",
    ({ parents }: any) => parents.map(({ ref }: any) => ({ ref, rows: null })),
    /rows must be an array/,
  ],
  [
    "invalid unselected output",
    ({ parents }: any) =>
      parents.map(({ ref }: any) => ({
        ref,
        rows: [{ label: "ok", amount: "bad" }],
      })),
    /resolveBatch output: amount/,
  ],
] as const) {
  test(`resolveBatch rejects ${name}`, async () => {
    const { read } = reader({ resolveBatch });
    await assert.rejects(
      read({ select: { items: { select: { label: true } } }, where }),
      (error: unknown) =>
        error instanceof ReadValidationError && message.test(error.message),
    );
  });
}

test("resolveBatch rejects references retained from a previous invocation", async () => {
  let previous: BatchParentRef | undefined;
  const { read } = reader({
    batchSize: 1,
    resolveBatch: ({ parents }) => {
      const ref = previous ?? parents[0].ref;
      previous = parents[0].ref;
      return [{ ref, rows: [] }];
    },
  });
  await assert.rejects(
    read({ select: { items: { select: { label: true } } }, where }),
    /duplicate or unknown/,
  );
});

test("resolveBatch enforces the candidate budget before filtering or pagination", async () => {
  const { read } = reader({
    maxCandidates: 1,
    resolveBatch: ({ parents }) =>
      parents.map(({ ref }) => ({
        ref,
        rows: [
          { label: "a", amount: 1 },
          { label: "b", amount: 2 },
        ],
      })),
  });
  await assert.rejects(
    read({
      select: {
        items: {
          select: { label: true },
          where: { amount: { $gte: 100 } },
          page: { limit: 1 },
        },
      },
      where,
    }),
    ReadBudgetError,
  );
});

test("resolveBatch preserves nullable/required to-one and cardinality validation", async () => {
  for (const nullable of [true, false]) {
    const { plan } = reader({
      resolveBatch: ({ parents }) =>
        parents.map(({ ref }) => ({ ref, rows: [] })),
    });
    const read = defineRead(
      defineResource({
        item: nullable ? field.one(Item).nullable() : field.one(Item),
      }),
      {
        source: categorySource,
        relations: { item: plan.one(Item) },
      },
    );
    const query = {
      select: { item: { select: { label: true } } },
      page: { limit: 1 },
    } as const;
    if (nullable)
      assert.deepEqual(await read(query), { rows: [{ item: null }] });
    else await assert.rejects(read(query), /Required relation/);
  }
  const { plan } = reader({
    resolveBatch: ({ parents }) =>
      parents.map(({ ref }) => ({
        ref,
        rows: [
          { label: "a", amount: 1 },
          { label: "b", amount: 2 },
        ],
      })),
  });
  const read = defineRead(defineResource({ item: field.one(Item) }), {
    source: categorySource,
    relations: { item: plan.one(Item) },
  });
  await assert.rejects(
    read({ select: { item: { select: { label: true } } }, page: { limit: 1 } }),
    /multiple rows/,
  );
});

test("resolveBatch propagates provider failures and validates batch size", async () => {
  const failure = new Error("upstream failure");
  const { read } = reader({
    resolveBatch: () => {
      throw failure;
    },
  });
  await assert.rejects(
    read({ select: { items: { select: { label: true } } }, where }),
    (error) => error === failure,
  );
  for (const batchSize of [0, -1, 0.5, Infinity, 10_001])
    assert.throws(
      () => reader({ batchSize, resolveBatch: () => [] }),
      /Batch size/,
    );
});
