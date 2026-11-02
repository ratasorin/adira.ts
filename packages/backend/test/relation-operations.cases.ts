/** Loaded by read.test.ts to share its private MongoDB lifecycle and seed hooks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  defineResource,
  field,
  ReadValidationError,
  ScalarField,
  schema,
} from "@n/adira.core.ts";
import { defineRead, mongo, ReadBudgetError } from "../read";
import {
  Categories,
  Products,
  categorySource,
  productSource,
  ProductResource,
  CategoryResource,
  filters,
  relations,
  ids,
  calls,
} from "./fixtures";

function operations(
  options: {
    appStock?: boolean;
    appScope?: boolean;
    appLabel?: boolean;
    maxCandidates?: number;
  } = {},
) {
  const calls = { label: 0, stock: 0 };
  let child = productSource.toApp();
  if (options.appStock)
    child = child.derive("stock", ["stock"], async (row) => {
      calls.stock++;
      return -row.stock;
    });
  if (options.appLabel)
    child = child.derive("name", ["name"], async (row) => {
      calls.label++;
      return row.name.toUpperCase();
    });
  const products = categorySource.many(ProductResource, {
    plan: child,
    localField: "_id",
    foreignField: "category",
    limits: {
      defaultLimit: 1,
      maxLimit: 1,
      maxCandidates: options.maxCandidates ?? 100,
    },
    scope: () =>
      options.appScope
        ? child.appCondition({
            requires: ["isActive"],
            evaluate: (row) => row.isActive,
          })
        : child.condition((e) => e.eq(e.field("isActive"), true)),
  });
  const source = categorySource
    .load("productCount", products.count())
    .load("hasProducts", products.exists())
    .load("stockTotal", products.sum({ field: "stock" }))
    .load("stockAverage", products.avg({ field: "stock" }))
    .load("stockMinimum", products.min({ field: "stock" }))
    .load("stockMaximum", products.max({ field: "stock" }))
    .load(
      "firstProduct",
      products.first({ select: { name: true }, orderBy: { stock: "asc" } }),
    )
    .load(
      "lastProduct",
      products.last({ select: { name: true }, orderBy: { stock: "asc" } }),
    )
    .derive(
      "firstName",
      ["firstProduct"],
      (row) => row.firstProduct?.name ?? null,
    )
    .derive(
      "lastName",
      ["lastProduct"],
      (row) => row.lastProduct?.name ?? null,
    );
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      productCount: field.number().filterable("$gte"),
      hasProducts: field.boolean(),
      stockTotal: field.number().filterable("$gte").orderable(),
      stockAverage: field.number().nullable(),
      stockMinimum: field.number().nullable(),
      stockMaximum: field.number().nullable(),
      firstName: field.string().nullable(),
      lastName: field.string().nullable(),
    }),
    {
      source,
      scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
    },
  );
  return { read, products, source, calls };
}
const selection = {
  name: true,
  productCount: true,
  hasProducts: true,
  stockTotal: true,
  stockAverage: true,
  stockMinimum: true,
  stockMaximum: true,
  firstName: true,
  lastName: true,
} as const;
const expected = [
  {
    name: "Art",
    productCount: 0,
    hasProducts: false,
    stockTotal: 0,
    stockAverage: null,
    stockMinimum: null,
    stockMaximum: null,
    firstName: null,
    lastName: null,
  },
  {
    name: "Games",
    productCount: 0,
    hasProducts: false,
    stockTotal: 0,
    stockAverage: null,
    stockMinimum: null,
    stockMaximum: null,
    firstName: null,
    lastName: null,
  },
  {
    name: "Books",
    productCount: 2,
    hasProducts: true,
    stockTotal: 10,
    stockAverage: 5,
    stockMinimum: 3,
    stockMaximum: 7,
    firstName: "Book A",
    lastName: "Book B",
  },
  {
    name: "Audio",
    productCount: 1,
    hasProducts: true,
    stockTotal: 0,
    stockAverage: 0,
    stockMinimum: 0,
    stockMaximum: 0,
    firstName: "Headphones",
    lastName: "Headphones",
  },
];

test("relation operations execute native reductions/limits and preserve empty results and child policy", async () => {
  const { read } = operations();
  const plan = read.inspect({ select: selection });
  assert.equal(Object.keys(plan.dependencies).length, 8);
  for (const dependency of Object.values(plan.dependencies)) {
    assert.equal(dependency.strategy, "mongodb");
    assert.ok(
      dependency.pipeline.some(
        (stage) =>
          "$group" in (stage as object) || "$limit" in (stage as object),
      ),
    );
  }
  assert.equal(plan.dependencies.productCount.execution, "bulk");
  assert.equal(plan.dependencies.stockTotal.execution, "bulk");
  assert.equal(plan.dependencies.stockAverage.execution, "bulk");
  assert.equal(plan.dependencies.stockMinimum.execution, "bulk");
  assert.equal(plan.dependencies.stockMaximum.execution, "bulk");
  assert.equal(plan.dependencies.hasProducts.execution, "parent-scoped");
  assert.deepEqual(await read({ select: selection }), { rows: expected });
});

test("native operations are lazy, batch parents, and return reductions instead of raw children", async () => {
  const { read, products } = operations();
  const adapter = products.options.source.state.collection;
  const original = adapter.scan;
  const batches: { keys: number; rows: number }[] = [];
  adapter.scan = async function* (pipeline, size) {
    assert.ok(!pipeline.some((stage) => "$lookup" in stage));
    const keys = (pipeline[0] as { $match: { category: { $in: unknown[] } } })
      .$match.category.$in;
    const batch = { keys: keys.length, rows: 0 };
    batches.push(batch);
    for await (const row of original.call(this, pipeline, size)) {
      batch.rows++;
      assert.equal(typeof row.value, "number");
      assert.equal(row.invalid, 0);
      yield row;
    }
  };
  try {
    assert.deepEqual(read.inspect({ select: { name: true } }).dependencies, {});
    await read({ select: { name: true } });
    assert.equal(batches.length, 0);
    assert.deepEqual(
      await read({ select: { name: true, productCount: true } }),
      {
        rows: expected.map(({ name, productCount }) => ({
          name,
          productCount,
        })),
      },
    );
    assert.deepEqual(batches, [
      { keys: 2, rows: 0 },
      { keys: 2, rows: 2 },
    ]);
  } finally {
    adapter.scan = original;
  }
});

test("application membership has the same operation results as native execution", async () => {
  const { read } = operations({ appScope: true });
  for (const dependency of Object.values(
    read.inspect({ select: selection }).dependencies,
  ))
    assert.equal(dependency.strategy, "application");
  assert.deepEqual(await read({ select: selection }), { rows: expected });
});

test("unused application fields do not block native count; computed aggregate fields use the fallback", async () => {
  const { read, calls } = operations({ appStock: true });
  const plan = read.inspect({ select: selection });
  assert.equal(plan.dependencies.productCount.strategy, "mongodb");
  assert.equal(plan.dependencies.hasProducts.strategy, "mongodb");
  assert.equal(plan.dependencies.stockTotal.strategy, "application");
  assert.equal(plan.dependencies.firstProduct.strategy, "application");
  await read({ select: { productCount: true } });
  assert.equal(calls.stock, 0);
  assert.deepEqual(
    await read({ select: selection, where: { name: { $eq: "Books" } } }),
    {
      rows: [
        {
          ...expected[2],
          stockTotal: -10,
          stockAverage: -5,
          stockMinimum: -7,
          stockMaximum: -3,
          firstName: "Book B",
          lastName: "Book A",
        },
      ],
    },
  );
});

test("first/last limit natively before computing selected application output", async () => {
  const { read, calls } = operations({ appLabel: true });
  const query = {
    select: { firstName: true, lastName: true },
    where: { name: { $eq: "Books" } },
  } as const;
  assert.equal(
    read.inspect(query).dependencies.firstProduct.strategy,
    "mongodb",
  );
  assert.deepEqual(await read(query), {
    rows: [{ firstName: "BOOK A", lastName: "BOOK B" }],
  });
  assert.equal(calls.label, 2);
});

test("native aggregates can filter/sort parents before their final page", async () => {
  const { read, products } = operations();
  assert.equal(
    read.inspect({ select: { name: true }, where: { stockTotal: { $gte: 5 } } })
      .nativePagination,
    false,
  );
  assert.deepEqual(
    await read({
      select: { name: true },
      where: {
        $or: [{ name: { $eq: "Games" } }, { stockTotal: { $gte: 5 } }],
      },
      page: { limit: 1 },
    }),
    { rows: [{ name: "Games" }] },
  );
  assert.deepEqual(
    await read({
      select: { name: true },
      orderBy: { stockTotal: "desc" },
      page: { limit: 1 },
    }),
    { rows: [{ name: "Books" }] },
  );
  const source = categorySource.load(
    "count",
    products.count({ where: { $not: { stock: { $gte: 5 } } } }),
  );
  const filtered = defineRead(
    defineResource({ name: field.string(), count: field.number() }),
    {
      source,
      scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
    },
  );
  assert.deepEqual(await filtered({ select: { name: true, count: true } }), {
    rows: [
      { name: "Art", count: 0 },
      { name: "Games", count: 0 },
      { name: "Books", count: 1 },
      { name: "Audio", count: 1 },
    ],
  });
});

test("native reductions avoid materialization budgets; complete application reductions fail explicitly", async () => {
  const native = operations({ maxCandidates: 1 }).read;
  assert.deepEqual(
    await native({
      select: { productCount: true, stockTotal: true },
      where: { name: { $eq: "Books" } },
    }),
    {
      rows: [{ productCount: 2, stockTotal: 10 }],
    },
  );
  await assert.rejects(
    operations({ appScope: true, maxCandidates: 1 }).read({
      select: { productCount: true },
      where: { name: { $eq: "Books" } },
    }),
    ReadBudgetError,
  );
});

test("nullable numeric reductions agree across native/application paths", async () => {
  await Products.collection.insertOne({
    category: ids.books,
    name: "Null",
    stock: null,
    isActive: true,
  } as never);
  await Products.collection.insertOne({
    category: ids.books,
    name: "Missing",
    isActive: true,
  } as never);
  await Products.collection.updateOne({ category: ids.audio }, {
    $set: { stock: null },
  } as never);
  const resource = defineResource({ stock: field.number().nullable() });
  function reader(application: boolean) {
    const child = productSource.toApp();
    const products = categorySource.many(resource, {
      plan: child,
      localField: "_id",
      foreignField: "category",
      scope: () =>
        application
          ? child.appCondition({
              requires: ["isActive"],
              evaluate: (row) => row.isActive,
            })
          : child.condition((e) => e.eq(e.field("isActive"), true)),
    });
    const source = categorySource
      .load("count", products.count())
      .load("sum", products.sum({ field: "stock" }))
      .load("avg", products.avg({ field: "stock" }))
      .load("min", products.min({ field: "stock" }))
      .load("max", products.max({ field: "stock" }));
    return defineRead(
      defineResource({
        name: field.string(),
        count: field.number(),
        sum: field.number(),
        avg: field.number().nullable(),
        min: field.number().nullable(),
        max: field.number().nullable(),
      }),
      {
        source,
        scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
      },
    );
  }
  const query = {
    select: {
      name: true,
      count: true,
      sum: true,
      avg: true,
      min: true,
      max: true,
    },
  } as const;
  const result = await reader(false)(query);
  assert.deepEqual(result, await reader(true)(query));
  assert.deepEqual(result.rows[2], {
    name: "Books",
    count: 4,
    sum: 10,
    avg: 5,
    min: 3,
    max: 7,
  });
  assert.deepEqual(result.rows[3], {
    name: "Audio",
    count: 1,
    sum: 0,
    avg: null,
    min: null,
    max: null,
  });
});

test("numeric native operations reject malformed/non-finite values rather than ignoring them", async () => {
  for (const value of ["bad", null, Number.NaN, Infinity, -Infinity]) {
    await Products.collection.insertOne({
      category: ids.books,
      name: "bad",
      stock: value,
      isActive: true,
    } as never);
    for (const appScope of [false, true])
      for (const select of [
        { stockTotal: true },
        { stockAverage: true },
        { stockMinimum: true },
        { stockMaximum: true },
      ] as const)
        await assert.rejects(
          operations({ appScope }).read({
            select,
            where: { name: { $eq: "Books" } },
          }),
          ReadValidationError,
        );
    await Products.collection.deleteMany({ name: "bad" });
  }
});

test("custom value parsers force application reduction and retain their transformations", async () => {
  const resource = defineResource({
    stock: new ScalarField(
      schema.custom<number>((value) => schema.number().parse(value) * 2),
    ),
  });
  const products = categorySource.many(resource, {
    plan: productSource,
    localField: "_id",
    foreignField: "category",
  });
  const source = categorySource.load("sum", products.sum({ field: "stock" }));
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      sum: field.number(),
    }),
    { source },
  );
  const query = {
    select: { sum: true },
    where: { name: { $eq: "Books" } },
  } as const;
  assert.equal(read.inspect(query).dependencies.sum.strategy, "application");
  assert.deepEqual(await read(query), { rows: [{ sum: 20 }] });
});

test("native operations preserve array correlation and deduplicate matching parent keys", async () => {
  const parent = mongo
    .from(Categories)
    .where((e) => e.eq(e.field("name"), "Books"))
    .derive("categoryKeys", (e) => e.literal([ids.books, ids.games, ids.books]))
    .toApp();
  const products = parent.many(ProductResource, {
    plan: productSource,
    localField: "categoryKeys",
    foreignField: "category",
  });
  const source = parent
    .load("count", products.count())
    .load("sum", products.sum({ field: "stock" }))
    .load(
      "last",
      products.last({ select: { name: true }, orderBy: { stock: "asc" } }),
    )
    .derive("lastName", ["last"], (row) => row.last?.name ?? null);
  const read = defineRead(
    defineResource({
      count: field.number(),
      sum: field.number(),
      lastName: field.string().nullable(),
    }),
    { source },
  );
  assert.deepEqual(
    await read({ select: { count: true, sum: true, lastName: true } }),
    { rows: [{ count: 3, sum: 20, lastName: "Game" }] },
  );

  const Links = mongoose.model(
    "OperationArrayLinks",
    new mongoose.Schema({
      parents: [mongoose.Schema.Types.ObjectId],
      value: { type: Number, required: true },
    }),
  );
  await Links.insertMany([
    { parents: [ids.books, ids.games, ids.books], value: 3 },
    { parents: [ids.books], value: 7 },
  ]);
  const links = categorySource.many(defineResource({ value: field.number() }), {
    plan: mongo.from(Links),
    localField: "_id",
    foreignField: "parents",
  });
  const linkedSource = categorySource.load(
    "sum",
    links.sum({ field: "value" }),
  );
  const linked = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      sum: field.number(),
    }),
    { source: linkedSource },
  );
  assert.deepEqual(
    await linked({ select: { sum: true }, where: { name: { $eq: "Books" } } }),
    { rows: [{ sum: 10 }] },
  );
});

test("get() preserves nullable relations and application output, and rejects multiple matches", async () => {
  const source = categorySource
    .load("creator", relations.createdBy.get({ select: { initials: true } }))
    .derive("initials", ["creator"], (row) => row.creator?.initials ?? null);
  const read = defineRead(
    defineResource({
      name: field.string(),
      initials: field.string().nullable(),
    }),
    {
      source,
      scope: () => source.condition((e) => e.eq(e.field("tenant"), "demo")),
    },
  );
  assert.equal(
    read.inspect({ select: { initials: true } }).dependencies.creator.strategy,
    "mongodb",
  );
  assert.deepEqual(await read({ select: { name: true, initials: true } }), {
    rows: [
      { name: "Art", initials: "AP" },
      { name: "Games", initials: null },
      { name: "Books", initials: "DI" },
      { name: "Audio", initials: "AP" },
    ],
  });
  assert.equal(calls.initials, 3);
  const wrong = categorySource.one(ProductResource, {
    plan: productSource,
    localField: "_id",
    foreignField: "category",
  });
  const wrongSource = categorySource
    .load("product", wrong.get({ select: { name: true } }))
    .derive("found", ["product"], (row) => row.product !== null);
  const wrongRead = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      found: field.boolean(),
    }),
    { source: wrongSource },
  );
  await assert.rejects(
    wrongRead({ select: { found: true }, where: { name: { $eq: "Books" } } }),
    /multiple rows/,
  );
});

test("first() supports nested complete relation selections", async () => {
  const categories = categorySource.many(CategoryResource, {
    plan: categorySource,
    localField: "_id",
    foreignField: "_id",
    relations,
    filters,
  });
  const source = categorySource
    .load(
      "category",
      categories.first({
        select: {
          products: { select: { stock: true } },
          createdBy: { select: { initials: true } },
        },
        orderBy: { id: "asc" },
      }),
    )
    .derive(
      "stock",
      ["category"],
      (row) =>
        row.category?.products.reduce((sum, item) => sum + item.stock, 0) ?? 0,
    );
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      stock: field.number(),
    }),
    { source },
  );
  assert.deepEqual(
    await read({ select: { stock: true }, where: { name: { $eq: "Books" } } }),
    { rows: [{ stock: 10 }] },
  );
});

test("operation options are validated before database access", () => {
  const { products } = operations();
  // Empty selections are enabled only inside aggregate preparation.
  assert.throws(
    () => operations().read.inspect({ select: {} }),
    ReadValidationError,
  );
  for (const dependency of [
    products.sum({ field: "name" } as never),
    products.count({ where: { stock: { $gte: "1" } } } as never),
    products.exists({ page: { limit: 1 } } as never),
    products.first({ select: { name: true }, orderBy: {} } as never),
    products.last({
      select: { name: true },
      orderBy: { stock: "asc" },
      page: { limit: 1 },
    } as never),
  ]) {
    const source = categorySource
      .load("invalid", dependency)
      .derive("value", ["invalid"], () => 0);
    const read = defineRead(defineResource({ value: field.number() }), {
      source,
    });
    assert.throws(
      () => read.inspect({ select: { value: true } }),
      ReadValidationError,
    );
  }
});

test("native operations return their empty values when the child collection is empty", async () => {
  await Products.deleteMany({});
  assert.deepEqual(await operations().read({ select: selection }), {
    rows: expected.map(({ name }) => ({ ...expected[0], name })),
  });
});

test("first/last ordering uses the same identity tie-breaker on native and application paths", async () => {
  await Products.collection.updateMany(
    { category: ids.books },
    { $set: { stock: 3 } },
  );
  await Products.collection.insertOne({
    _id: new mongoose.Types.ObjectId("000000000000000000000001"),
    category: ids.books,
    name: "Earlier",
    stock: 3,
    isActive: true,
  });
  const query = {
    select: { firstName: true, lastName: true },
    where: { name: { $eq: "Books" } },
  } as const;
  assert.deepEqual(await operations().read(query), {
    rows: [{ firstName: "Earlier", lastName: "Book B" }],
  });
  assert.deepEqual(
    await operations({ appScope: true }).read(query),
    await operations().read(query),
  );
});

test("native count skips unused derivations while numeric reductions validate their required fields", async () => {
  const child = productSource.derive("stock", (e) =>
    e.multiply(e.field("stock"), e.literal(Number.MAX_VALUE)),
  );
  const products = categorySource.many(ProductResource, {
    plan: child,
    localField: "_id",
    foreignField: "category",
  });
  const source = categorySource
    .load("count", products.count())
    .load("total", products.sum({ field: "stock" }));
  const read = defineRead(
    defineResource({
      name: field.string().filterable("$eq"),
      count: field.number(),
      total: field.number(),
    }),
    { source },
  );
  const query = {
    select: { count: true },
    where: { name: { $eq: "Books" } },
  } as const;
  assert.equal(read.inspect(query).dependencies.count.strategy, "mongodb");
  assert.deepEqual(await read(query), { rows: [{ count: 2 }] });
  await assert.rejects(
    read({ select: { total: true }, where: query.where }),
    ReadValidationError,
  );
});
