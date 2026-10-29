import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import express, { Request, Response } from "express";
import type { AddressInfo } from "node:net";
import {
  Backend,
  defineResource,
  field,
  ReadQuery,
  ReadValidationError,
  ReadWhere,
  schema,
} from "@n/adira.core.ts";
import { createApiClient } from "../../client/index";
import { defineRead, mongo, ReadBudgetError } from "../read";
import {
  Categories,
  Creators,
  CategoryResource,
  categorySource,
  filters,
  relations,
  calls,
  getCategories,
  seed,
  ids,
  CreatorResource,
  creatorSource,
  ProductResource,
  productSource,
} from "./fixtures";
import { temporaryMongo } from "./mongo";
import "./relation-operations.cases";
import "./bulk-reductions.cases";
import "./reduction-fusion.cases";
import "./relation-context.cases";
import "./resolve-batch.cases";
import "./read-context.cases";
import "./native-pruning.cases";
import "./native-producers.cases";
import "./predicate-pushdown.cases";
import "./native-pagination.cases";
import "./index-lowering.cases";
import "./flat-response.cases";
import "./conditional-queries.cases";

let database: Awaited<ReturnType<typeof temporaryMongo>> | undefined;
before(async () => {
  database = await temporaryMongo();
  await mongoose.connect(database.uri, { serverSelectionTimeoutMS: 5000 });
});
beforeEach(seed);
after(async () => {
  try {
    await mongoose.disconnect();
  } finally {
    await database?.stop();
  }
});

function stockReader(maxCandidates = 100) {
  const calls = { stock: 0 };
  const child = productSource
    .toApp()
    .derive("stock", ["stock"], async (row, context) => {
      calls.stock++;
      const factor = (context as { factor?: number } | undefined)?.factor ?? 2;
      return row.stock * factor;
    });
  const products = categorySource.many(ProductResource, {
    plan: child,
    localField: "_id",
    foreignField: "category",
    limits: { defaultLimit: 1, maxLimit: 1, maxCandidates },
    scope: () => child.condition((e) => e.eq(e.field("isActive"), true)),
  });
  const source = categorySource
    .load(
      "stockInputs",
      products.all({
        select: { stock: true },
        where: { stock: { $gte: 1 } },
      }),
    )
    .derive("stockTotal", ["stockInputs"], ({ stockInputs }) =>
      stockInputs.reduce((sum, product) => sum + product.stock, 0),
    );
  const resource = defineResource({
    name: field.string().filterable("$eq"),
    stockTotal: field.number().filterable("$gte").orderable(),
    products: field.many(ProductResource),
  });
  const read = defineRead(resource, {
    source,
    relations: { products },
    scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
    filters: {
      name: {
        $eq: (expected) =>
          source.appCondition({
            requires: ["name"],
            evaluate: (row) => row.name === expected,
          }),
      },
    },
  });
  return { read, source, products, calls };
}

test("relation dependencies are lazy and unused computations do not load children", async () => {
  const { read, calls } = stockReader(1);
  assert.equal(calls.stock, 0);
  assert.ok(
    !read
      .inspect({ select: { name: true } })
      .application.some((step) => step.startsWith("load ")),
  );
  assert.deepEqual(
    await read({ select: { name: true }, where: { name: { $eq: "Books" } } }),
    {
      rows: [{ name: "Books" }],
    },
  );
  assert.equal(calls.stock, 0);
});

test("display-only relation dependencies load after application filtering and pagination", async () => {
  const { read, calls } = stockReader();
  const query = {
    select: { name: true, stockTotal: true },
    where: { name: { $eq: "Books" } },
    page: { limit: 1 },
  } as const;
  assert.deepEqual(read.inspect(query).application, [
    "evaluate Boolean filter",
    "paginate",
    "load stockInputs",
    "derive stockTotal",
  ]);
  assert.deepEqual(await read(query, { factor: 3 }), {
    rows: [{ name: "Books", stockTotal: 30 }],
  });
  // Books and Audio share a root cursor batch; only Books needs child work.
  assert.equal(calls.stock, 2);
});

test("relation-derived predicates compose through Boolean filters and run before pagination", async () => {
  const { read } = stockReader();
  const query = {
    select: { name: true, stockTotal: true },
    where: { stockTotal: { $gte: 15 } },
    page: { limit: 1 },
  } as const;
  assert.deepEqual(read.inspect(query).application, [
    "load stockInputs",
    "derive stockTotal",
    "evaluate Boolean filter",
    "paginate",
  ]);
  assert.deepEqual(await read(query), {
    rows: [{ name: "Books", stockTotal: 20 }],
  });
  assert.deepEqual(
    await read({
      select: { name: true },
      where: {
        $or: [{ name: { $eq: "Games" } }, { stockTotal: { $gte: 15 } }],
      },
      page: { limit: 1 },
    }),
    { rows: [{ name: "Games" }] },
  );
  assert.deepEqual(
    await read({
      select: { name: true },
      where: {
        $not: {
          $or: [{ name: { $eq: "Games" } }, { stockTotal: { $gte: 15 } }],
        },
      },
    }),
    { rows: [{ name: "Art" }, { name: "Audio" }] },
  );
  assert.deepEqual(
    await read({
      select: { name: true, stockTotal: true },
      orderBy: { stockTotal: "desc" },
      page: { limit: 1 },
    }),
    { rows: [{ name: "Books", stockTotal: 20 }] },
  );
});

test("complete dependencies respect child policy and are independent of displayed child pages", async () => {
  const { read } = stockReader();
  assert.deepEqual(
    await read({
      select: {
        name: true,
        stockTotal: true,
        products: {
          select: { name: true, stock: true },
          orderBy: { stock: "asc" },
          page: { limit: 1 },
        },
      },
      where: { name: { $eq: "Books" } },
    }),
    {
      rows: [
        {
          name: "Books",
          stockTotal: 20,
          products: [{ name: "Book A", stock: 6 }],
        },
      ],
    },
  );
  // The stored Game has stock 10 but is excluded by the relation's backend scope.
  assert.deepEqual(
    await read({
      select: { name: true, stockTotal: true },
      where: { name: { $eq: "Games" } },
    }),
    { rows: [{ name: "Games", stockTotal: 0 }] },
  );
});

test("relation dependencies batch parent contexts into one child aggregation per cursor batch", async () => {
  const { read, products } = stockReader();
  const adapter = products.options.source.state.collection;
  const scan = adapter.scan;
  const keyCounts: number[] = [];
  adapter.scan = async function* (pipeline, batchSize) {
    const parentStage = pipeline.find(
      (stage) => "$project" in stage && "__adira_parent" in stage.$project,
    ) as { $project: { __adira_parent: { $literal: unknown[] } } };
    keyCounts.push(parentStage.$project.__adira_parent.$literal.length);
    yield* scan.call(this, pipeline, batchSize);
  };
  try {
    assert.deepEqual(await read({ select: { name: true, stockTotal: true } }), {
      rows: [
        { name: "Art", stockTotal: 0 },
        { name: "Games", stockTotal: 0 },
        { name: "Books", stockTotal: 20 },
        { name: "Audio", stockTotal: 0 },
      ],
    });
    assert.deepEqual(keyCounts, [2, 2]);
  } finally {
    adapter.scan = scan;
  }
});

test("complete dependencies support nested includes and child dependencies", async () => {
  const { source: stockSource, products } = stockReader();
  const resource = defineResource({
    products: field.many(ProductResource),
    creator: field.one(CreatorResource).nullable(),
    stockTotal: field.number(),
  });
  const summaries = categorySource.many(resource, {
    plan: stockSource,
    localField: "_id",
    foreignField: "_id",
    relations: { products, creator: relations.createdBy },
    limits: { defaultLimit: 1, maxLimit: 1 },
  });
  const source = categorySource
    .load(
      "summaries",
      summaries.all({
        select: {
          stockTotal: true,
          products: { select: { stock: true } },
          creator: { select: { initials: true } },
        },
      }),
    )
    .derive(
      "stockTotal",
      ["summaries"],
      ({ summaries }) => summaries[0]?.stockTotal ?? 0,
    )
    .derive("nestedTotal", ["summaries"], ({ summaries }) =>
      summaries.reduce(
        (sum, item) =>
          sum +
          item.products.reduce(
            (subtotal, product) => subtotal + product.stock,
            0,
          ),
        0,
      ),
    )
    .derive(
      "owner",
      ["summaries"],
      ({ summaries }) => summaries[0]?.creator?.initials ?? null,
    );
  const read = defineRead(
    defineResource({
      name: field.string(),
      stockTotal: field.number(),
      nestedTotal: field.number(),
      owner: field.string().nullable(),
    }),
    {
      source,
      scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
    },
  );
  assert.deepEqual(
    await read({
      select: { name: true, stockTotal: true, nestedTotal: true, owner: true },
    }),
    {
      rows: [
        { name: "Art", stockTotal: 0, nestedTotal: 0, owner: "AP" },
        { name: "Games", stockTotal: 0, nestedTotal: 0, owner: null },
        { name: "Books", stockTotal: 20, nestedTotal: 20, owner: "DI" },
        { name: "Audio", stockTotal: 0, nestedTotal: 0, owner: "AP" },
      ],
    },
  );
});

test("complete dependencies fail on budget exhaustion instead of returning partial totals", async () => {
  const { read } = stockReader(1);
  await assert.rejects(
    read({
      select: { stockTotal: true },
      where: { name: { $eq: "Books" } },
    }),
    ReadBudgetError,
  );
});

test("dependency misuse is rejected before execution", () => {
  assert.throws(
    () =>
      mongo
        .from(Categories)
        .toApp()
        .load(
          "inputs",
          relations.products.all({ select: { stock: true } }) as never,
        ),
    /same source/,
  );
  const one = relations.createdBy as unknown as typeof relations.products;
  assert.throws(() => one.all({ select: { name: true } }), /to-many/);
  const nested = categorySource.many(
    defineResource({ products: field.many(ProductResource) }),
    {
      plan: categorySource,
      localField: "_id",
      foreignField: "_id",
      relations: { products: relations.products },
    },
  );
  for (const dependency of [
    relations.products.all({
      select: { stock: true },
      page: { limit: 1 },
    } as never),
    nested.all({
      select: { products: { select: { stock: true }, page: { limit: 1 } } },
    } as never),
  ]) {
    const source = categorySource
      .load("inputs", dependency)
      .derive("count", ["inputs"], () => 0);
    const read = defineRead(defineResource({ count: field.number() }), {
      source,
    });
    assert.throws(
      () => read.inspect({ select: { count: true } }),
      /all\(\) does not accept pagination/,
    );
  }
  const resource = defineResource({ name: field.string() });
  const self = categorySource.many(resource, {
    plan: categorySource,
    localField: "_id",
    foreignField: "_id",
  });
  const source = categorySource
    .load("inputs", self.all({ select: { name: true } }))
    .derive("name", ["inputs"], (row) => row.inputs[0]?.name ?? "");
  // Deliberately construct an invalid cycle through the low-level options.
  self.options.source = source;
  const cyclicRead = defineRead(resource, { source });
  assert.throws(
    () => cyclicRead.inspect({ select: { name: true } }),
    /Cyclic relation dependency/,
  );
});

test("deferring display computations preserves intermediate values overwritten by later stages", async () => {
  const source = categorySource
    .derive("score", ["subtotal"], (row) => row.subtotal)
    .derive("label", ["score"], (row) => String(row.score))
    .derive("score", [], () => 0);
  const read = defineRead(
    defineResource({
      label: field.string(),
      score: field.number().filterable("$gte"),
    }),
    { source },
  );
  assert.deepEqual(
    await read({
      select: { label: true },
      where: { score: { $gte: 0 } },
      page: { limit: 1 },
    }),
    {
      rows: [{ label: "10" }],
    },
  );
});

test("native filtering and pagination stay in MongoDB; unused app fields are not resolved", async () => {
  const query = {
    select: { name: true, total: true },
    where: { total: { $gte: 30 } },
    page: { limit: 1 },
  } as const;
  const plan = getCategories.inspect(query);
  assert.equal(plan.nativePagination, true);
  assert.ok(plan.pipeline.some((stage) => "$limit" in (stage as object)));
  assert.deepEqual(await getCategories(query), {
    rows: [{ name: "Books", total: 36 }],
  });
  assert.equal(calls.displayName, 0);
});

test("a custom include runs its native prefix in $lookup and its requested app suffix afterward", async () => {
  const query = {
    select: {
      name: true,
      createdBy: { select: { displayName: true, initials: true } },
    },
    page: { limit: 1 },
  } as const;
  const plan = getCategories.inspect(query);
  assert.ok(plan.pipeline.some((stage) => "$lookup" in (stage as object)));
  assert.deepEqual(plan.deferredRelations, []);
  assert.deepEqual(plan.relations.createdBy.application, ["derive initials"]);
  assert.deepEqual(await getCategories(query), {
    rows: [
      { name: "Art", createdBy: { displayName: "ANA POP", initials: "AP" } },
    ],
  });
  assert.equal(calls.initials, 1);
  assert.equal(calls.displayName, 0);
});

test("included relations respect their backend scope and nullability", async () => {
  const result = await getCategories({
    select: { name: true, createdBy: { select: { name: true } } },
    where: { name: { $eq: "Games" } },
  });
  assert.deepEqual(result, { rows: [{ name: "Games", createdBy: null }] });
  assert.equal(calls.initials, 0);
});

test("custom raw include pipelines infer output from a schema and retain their join key", async () => {
  const objectId = schema.custom<mongoose.Types.ObjectId>((value) => {
    if (!(value instanceof mongoose.Types.ObjectId))
      throw new Error("Expected an ObjectId");
    return value;
  });
  const source = mongo
    .from(Creators)
    .native({
      stages: [
        {
          $project: {
            _id: 1,
            name: 1,
            id: { $toString: "$_id" },
            displayName: { $concat: ["Author: ", "$name"] },
          },
        },
      ],
      output: schema.object({
        _id: objectId,
        name: schema.string(),
        id: schema.string(),
        displayName: schema.string(),
      }),
      preserves: ["_id"],
    })
    .toApp()
    .derive("initials", ["name"], (row) =>
      row.name
        .split(" ")
        .map((part) => part[0])
        .join(""),
    );
  const read = defineRead(CategoryResource, {
    source: categorySource,
    filters,
    relations: {
      ...relations,
      createdBy: categorySource.one(CreatorResource, {
        plan: source,
        localField: "createdBy",
        foreignField: "_id",
      }),
    },
  });
  assert.deepEqual(
    await read({
      select: { createdBy: { select: { displayName: true, initials: true } } },
      page: { limit: 1 },
    }),
    {
      rows: [{ createdBy: { displayName: "Author: Ana Pop", initials: "AP" } }],
    },
  );
});

test("a custom MongoDB predicate can prepare a lookup and compose through OR and NOT", async () => {
  assert.deepEqual(
    await getCategories({
      select: { name: true },
      where: { hasAvailableProducts: { $eq: true } },
    }),
    { rows: [{ name: "Books" }] },
  );
  assert.deepEqual(
    await getCategories({
      select: { name: true },
      where: {
        $or: [
          { hasAvailableProducts: { $eq: true } },
          { name: { $startsWith: "A" } },
        ],
      },
    }),
    { rows: [{ name: "Art" }, { name: "Books" }, { name: "Audio" }] },
  );
  assert.deepEqual(
    await getCategories({
      select: { name: true },
      where: {
        $not: { hasAvailableProducts: { $eq: true } },
      },
    }),
    { rows: [{ name: "Art" }, { name: "Games" }, { name: "Audio" }] },
  );
});

test("repeated native preparations have isolated truth values", async () => {
  assert.deepEqual(
    await getCategories({
      select: { name: true },
      where: {
        $and: [
          { hasAvailableProducts: { $eq: true } },
          { hasAvailableProducts: { $eq: false } },
        ],
      },
    }),
    { rows: [] },
  );
});

test("mixed OR keeps rows from either implementation and paginates after membership", async () => {
  const query = {
    select: { name: true },
    where: {
      $or: [{ name: { $startsWith: "A" } }, { eligible: { $eq: true } }],
    },
    page: { limit: 2 },
  } as const;
  const plan = getCategories.inspect(query);
  assert.equal(plan.nativePagination, false);
  assert.ok(!plan.pipeline.some((stage) => "$limit" in (stage as object)));
  assert.deepEqual(await getCategories(query), {
    rows: [{ name: "Art" }, { name: "Books" }],
  });
  assert.equal(calls.eligible, 2); // Games is rejected; Books must still be visited.
  assert.deepEqual(
    await getCategories({ ...query, page: { offset: 1, limit: 2 } }),
    { rows: [{ name: "Books" }, { name: "Audio" }] },
  );
});

test("arbitrarily nested mixed negation preserves the Boolean tree and backend scope", async () => {
  const result = await getCategories({
    select: { name: true },
    where: {
      $not: {
        $or: [
          { name: { $startsWith: "A" } },
          { $not: { eligible: { $eq: true } } },
        ],
      },
    },
  });
  assert.deepEqual(result, { rows: [{ name: "Books" }] });
  const all = await getCategories({
    select: { name: true },
    where: { $not: { eligible: { $eq: false } } },
  });
  assert.deepEqual(all, { rows: [{ name: "Books" }, { name: "Audio" }] });
});

test("application fallback compares ObjectId scopes by value", async () => {
  const resource = defineResource({ name: field.string() });
  const source = mongo
    .from(Categories)
    .sortBy({ _id: 1 })
    .toApp()
    .map((row) => ({ name: row.name, createdBy: row.createdBy }));
  const read = defineRead(resource, {
    source,
    scope: () => source.condition((e) => e.eq(e.field("createdBy"), ids.ana)),
  });
  assert.deepEqual(await read({ select: { name: true } }), {
    rows: [{ name: "Art" }, { name: "Audio" }, { name: "Alien" }],
  });
});

test("native-specific conversion predicates require an explicit application implementation after custom mapping", async () => {
  const resource = defineResource({ name: field.string().filterable("$eq") });
  const source = mongo
    .from(Categories)
    .toApp()
    .map((row) => ({ name: row.name }));
  const read = defineRead(resource, {
    source,
    filters: {
      name: {
        $eq: (expected) =>
          source.condition((e) => e.eq(e.upper(e.field("name")), expected)),
      },
    },
  });
  await assert.rejects(
    read({ select: { name: true }, where: { name: { $eq: "ART" } } }),
    /provide an application implementation/,
  );
});

test("native and application scalar predicates agree through nested negation and null/missing values", async () => {
  const Scalars = mongoose.model<{
    score?: number | null;
    label?: string | null;
  }>("ReadScalar", new mongoose.Schema({ score: Number, label: String }));
  await Scalars.insertMany([
    { score: 1, label: "Art" },
    { score: 3, label: "ăbc" },
    { score: null, label: null },
    {},
    { score: -1, label: "Books" },
    { score: 0, label: "" },
  ]);
  const resource = defineResource({
    score: field
      .number()
      .nullable()
      .filterable("$eq", "$ne", "$in", "$nin", "$gte", "$lt")
      .orderable(),
    label: field
      .string()
      .nullable()
      .filterable("$eq", "$ne", "$contains", "$startsWith")
      .orderable(),
  });
  const source = mongo.from(Scalars).native({
    stages: [],
    output: schema.object({
      score: schema.nullable(schema.number()),
      label: schema.nullable(schema.string()),
    }),
  });
  const nativeRead = defineRead(resource, { source });
  const applicationRead = defineRead(resource, {
    source: source.toApp().map((row) => ({ ...row })),
  });
  const leaves: ReadWhere<typeof resource>[] = [
    { score: { $eq: null } },
    { score: { $ne: 0 } },
    { score: { $in: [null, 3] } },
    { score: { $nin: [-1] } },
    { score: { $gte: 0 } },
    { score: { $lt: 3 } },
    { label: { $contains: "b" } },
    { label: { $startsWith: "ă" } },
    { label: { $eq: "" } },
    { label: { $ne: null } },
  ];
  const expressions = [
    ...leaves,
    ...leaves.map(
      (leaf, index) =>
        ({
          $not: { $or: [leaf, { $not: leaves[(index + 3) % leaves.length] }] },
        }) satisfies ReadWhere<typeof resource>,
    ),
  ];
  for (const where of expressions) {
    const query = {
      select: { score: true, label: true },
      where,
      orderBy: { score: "asc", label: "asc" },
    } as const;
    assert.equal(nativeRead.inspect(query).nativePagination, true);
    assert.equal(applicationRead.inspect(query).nativePagination, false);
    assert.deepEqual(
      await nativeRead(query),
      await applicationRead(query),
      JSON.stringify(where),
    );
  }
});

test("includes needed only for display are deferred until after application filtering", async () => {
  const query = {
    select: { name: true, createdBy: { select: { initials: true } } },
    where: { eligible: { $eq: true } },
    page: { limit: 2 },
  } as const;
  assert.deepEqual(getCategories.inspect(query).deferredRelations, [
    "createdBy",
  ]);
  assert.deepEqual(await getCategories(query), {
    rows: [
      { name: "Books", createdBy: { initials: "DI" } },
      { name: "Audio", createdBy: { initials: "AP" } },
    ],
  });
  assert.equal(calls.initials, 2);
});

test("to-many filtering, ordering, and pagination apply independently to each parent", async () => {
  assert.deepEqual(
    await getCategories({
      select: {
        name: true,
        products: {
          select: { name: true, stock: true },
          where: { stock: { $gte: 0 } },
          orderBy: { stock: "asc" },
          page: { limit: 1 },
        },
      },
    }),
    {
      rows: [
        { name: "Art", products: [] },
        { name: "Games", products: [{ name: "Game", stock: 10 }] },
        { name: "Books", products: [{ name: "Book A", stock: 3 }] },
        { name: "Audio", products: [{ name: "Headphones", stock: 0 }] },
      ],
    },
  );
});

test("deferred relations union array keys before sorting and pagination", async () => {
  const resource = defineResource({
    name: field.string(),
    creators: field.many(CreatorResource),
  });
  const native = mongo
    .from(Categories)
    .where((e) => e.eq(e.field("name"), "Books"))
    .derive("creatorKeys", (e) => e.literal([ids.dan, ids.ana, ids.ana]));
  const query = {
    select: {
      name: true,
      creators: {
        select: { name: true },
        orderBy: { id: "asc" },
        page: { offset: 1, limit: 1 },
      },
    },
  } as const;
  const nativeRead = defineRead(resource, {
    source: native,
    relations: {
      creators: native.many(CreatorResource, {
        plan: creatorSource,
        localField: "creatorKeys",
        foreignField: "_id",
      }),
    },
  });
  const app = native.toApp().filter(() => true);
  const appRead = defineRead(resource, {
    source: app,
    relations: {
      creators: app.many(CreatorResource, {
        plan: creatorSource,
        localField: "creatorKeys",
        foreignField: "_id",
      }),
    },
  });
  assert.deepEqual(nativeRead.inspect(query).deferredRelations, []);
  assert.deepEqual(appRead.inspect(query).deferredRelations, ["creators"]);
  const expected = {
    rows: [{ name: "Books", creators: [{ name: "Dan Ionescu" }] }],
  };
  assert.deepEqual(await nativeRead(query), expected);
  assert.deepEqual(await appRead(query), expected);
});

test("to-one providers detect multiple matches instead of silently choosing one", async () => {
  const resource = defineResource({ creator: field.one(CreatorResource) });
  const source = mongo
    .from(Categories)
    .derive("creatorKeys", (e) => e.literal([ids.ana, ids.dan]));
  const read = defineRead(resource, {
    source,
    relations: {
      creator: source.one(CreatorResource, {
        plan: creatorSource,
        localField: "creatorKeys",
        foreignField: "_id",
      }),
    },
  });
  await assert.rejects(
    read({ select: { creator: { select: { name: true } } } }),
    /returned multiple rows/,
  );
});

test("child application filtering preserves each parent's page and child provider limits", async () => {
  const resource = defineResource({
    name: field.string(),
    creator: field.one(CreatorResource).nullable(),
  });
  const read = defineRead(resource, {
    source: categorySource,
    relations: {
      creator: categorySource.one(CreatorResource, {
        plan: creatorSource.filter((row) => row.name.startsWith("Ana")),
        localField: "createdBy",
        foreignField: "_id",
      }),
    },
  });
  assert.deepEqual(
    await read({
      select: { name: true, creator: { select: { name: true } } },
      page: { limit: 3 },
    }),
    {
      rows: [
        { name: "Art", creator: { name: "Ana Pop" } },
        { name: "Games", creator: null },
        { name: "Books", creator: null },
      ],
    },
  );
  const manyResource = defineResource({
    creators: field.many(CreatorResource),
  });
  const limited = defineRead(manyResource, {
    source: categorySource,
    relations: {
      creators: categorySource.many(CreatorResource, {
        plan: creatorSource,
        localField: "createdBy",
        foreignField: "_id",
        limits: { maxLimit: 1 },
      }),
    },
  });
  await assert.rejects(
    limited({
      select: { creators: { select: { name: true }, page: { limit: 2 } } },
    }),
    ReadValidationError,
  );
  assert.deepEqual(
    await limited({
      select: { creators: { select: { name: true } } },
      page: { limit: 1 },
    }),
    {
      rows: [{ creators: [{ name: "Ana Pop" }] }],
    },
  );
});

test("application-derived sorting happens before final pagination", async () => {
  const query = {
    select: { displayName: true },
    orderBy: { displayName: "desc" },
    page: { limit: 2 },
  } as const;
  assert.equal(getCategories.inspect(query).nativePagination, false);
  assert.deepEqual(await getCategories(query), {
    rows: [{ displayName: "Games (inactive)" }, { displayName: "Books" }],
  });
});

test("candidate budgets fail explicitly rather than returning an incomplete page", async () => {
  const limited = defineRead(CategoryResource, {
    source: categorySource,
    relations,
    filters,
    limits: { maxCandidates: 2 },
    scope: () =>
      categorySource.condition((e) => e.eq(e.field("tenant"), "demo")),
  });
  await assert.rejects(
    limited({
      select: { name: true },
      where: { eligible: { $eq: true } },
      page: { limit: 2 },
    }),
    ReadBudgetError,
  );
});

test("invalid queries fail before database access", async () => {
  const adapter = categorySource.state.collection;
  const original = adapter.scan;
  let scans = 0;
  adapter.scan = async function* () {
    scans++;
    throw new Error("Database must not be touched");
  };
  try {
    const invalid = [
      { select: { secret: true } },
      { select: { name: true }, groupBy: ["name"] },
      { select: { name: true }, where: { $where: "anything" } },
      { select: { name: true }, where: { total: { $gte: "3" } } },
      { select: { name: true }, where: { $or: [] } },
      { select: { name: true }, page: { limit: -1 } },
      { select: { name: true }, orderBy: { slug: "asc" } },
    ];
    for (const query of invalid)
      await assert.rejects(
        getCategories(query as ReadQuery<typeof CategoryResource>),
        ReadValidationError,
      );
    assert.equal(scans, 0);
  } finally {
    adapter.scan = original;
  }
});

test("the parser bounds JSON bytes, recursion, and node count before database work", async () => {
  const resource = defineResource({ name: field.string().filterable("$eq") });
  const source = mongo.from(Categories);
  const read = defineRead(resource, {
    source,
    limits: { maxQueryBytes: 150, maxDepth: 5, maxNodes: 20 },
  });
  await assert.rejects(
    read({ select: { name: true }, where: { name: { $eq: "ă".repeat(60) } } }),
    /too large/,
  );
  await assert.rejects(
    read({
      select: { name: true },
      where: { $not: { $not: { $not: { $not: { name: { $eq: "Art" } } } } } },
    }),
    /maximum depth/,
  );
  const cyclic: Record<string, unknown> = { select: { name: true } };
  cyclic.where = cyclic;
  await assert.rejects(
    read(cyclic as ReadQuery<typeof resource>),
    /JSON serializable/,
  );
  const fewNodes = defineRead(resource, { source, limits: { maxNodes: 3 } });
  await assert.rejects(
    fewNodes({ select: { name: true }, where: { name: { $eq: "Art" } } }),
    /node count/,
  );
});

test("raw native outputs are validated against their declared schema", async () => {
  const resource = defineResource({ name: field.string() });
  const source = mongo.from(Categories).native({
    stages: [{ $project: { name: { $literal: 42 }, _id: 0 } }],
    output: schema.object({ name: schema.string() }),
  });
  await assert.rejects(
    defineRead(resource, { source })({ select: { name: true } }),
    ReadValidationError,
  );
  const sourceWithMissingOutput = mongo.from(Categories).native({
    stages: [{ $project: { _id: 0, id: { $toString: "$_id" } } }],
    output: schema.object({ id: schema.string(), missing: schema.string() }),
  });
  const onlyId = defineRead(defineResource({ id: field.string() }), {
    source: sourceWithMissingOutput,
  });
  await assert.rejects(onlyId({ select: { id: true } }), ReadValidationError);
});

test("predicate preparation cannot discard parents or overwrite their fields", () => {
  assert.throws(
    () =>
      categorySource.pipelineCondition({
        requires: ["name"],
        preservesRows: true,
        stages: [{ $match: { name: "Art" } }],
        output: schema.object({ flag: schema.boolean() }),
        test: (e) => e.field("flag"),
      }),
    /cannot filter or replace parents/,
  );
  assert.throws(
    () =>
      categorySource.pipelineCondition({
        requires: ["name"],
        preservesRows: true,
        stages: [{ $set: { name: "changed" } }],
        output: schema.object({ name: schema.string() }),
        test: (e) => e.eq(e.field("name"), "changed"),
      }),
    /cannot overwrite/,
  );
});

test("read-only native fragments reject database writes", () => {
  assert.throws(
    () =>
      mongo.from(Categories).native({
        stages: [{ $out: "elsewhere" }],
        output: schema.object({ name: schema.string() }),
      }),
    /cannot contain/,
  );
});

test("a full custom application transformation keeps inference and final shape checks", async () => {
  const resource = defineResource({ name: field.string() });
  const source = mongo
    .from(Categories)
    .where((e) => e.eq(e.field("tenant"), "demo"))
    .toApp({ batchSize: 2 })
    .transformBatch((rows) =>
      [...rows].reverse().map((row) => ({ name: row.name.toUpperCase() })),
    );
  const read = defineRead(resource, { source });
  assert.deepEqual(await read({ select: { name: true }, page: { limit: 2 } }), {
    rows: [{ name: "GAMES" }, { name: "ART" }],
  });
});

type ErrorResponse = { error: true; message: string };
type GetCategoriesFn = typeof getCategories;
type DemoAPI = {
  "/api/categories/composable": {
    GET: {
      RequestQuery: Backend.InferHandlerParams<GetCategoriesFn>;
      ResponseBody:
        | Backend.InferHandlerResponse<GetCategoriesFn>
        | ErrorResponse;
    };
  };
};

test("the existing Express annotation and typed Axios client work end to end", async () => {
  const app = express();
  app.get(
    "/api/categories/composable",
    async (
      req: Request<
        never,
        unknown,
        unknown,
        Backend.InferHandlerParams<GetCategoriesFn>
      >,
      res: Response<
        Backend.InferHandlerResponse<GetCategoriesFn> | ErrorResponse
      >,
    ) => {
      try {
        res.send(await getCategories(req.query));
      } catch (error) {
        res
          .status(error instanceof ReadValidationError ? 400 : 500)
          .send({ error: true, message: String(error) });
      }
    },
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const api = createApiClient<DemoAPI>(baseUrl);
    const response = await api(
      "/categories/composable",
      "GET",
    )({
      query: {
        select: {
          name: true,
          createdBy: { select: { displayName: true, initials: true } },
        },
        where: {
          $or: [
            { name: { $startsWith: "A" } },
            { $not: { eligible: { $eq: false } } },
          ],
        },
        page: { limit: 2 },
      },
    }).run();
    assert.deepEqual(response, {
      rows: [
        {
          name: "Art",
          createdBy: { displayName: "ANA POP", initials: "AP" },
        },
        {
          name: "Books",
          createdBy: { displayName: "DAN IONESCU", initials: "DI" },
        },
      ],
    });
    const invalid = await fetch(
      `${baseUrl}/api/categories/composable?query=${encodeURIComponent(JSON.stringify({ select: { missing: true } }))}`,
    );
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
