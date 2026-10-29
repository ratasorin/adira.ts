import mongoose from "mongoose";
import {
  defineResource,
  field,
  schema,
  type ReadQuery,
} from "@n/adira.core.ts";
import { defineRead } from "../read";
import {
  calls,
  CategoryResource,
  categorySource,
  getCategories,
  ProductResource,
  productSource,
  relations,
  seed,
  Products,
} from "./fixtures";
import { temporaryMongo } from "./mongo";
import { readNativeStocks } from "./native-producers.fixture";

async function main(): Promise<void> {
  const database = await temporaryMongo();
  try {
    await mongoose.connect(database.uri);
    await seed();
    const examples = [
      {
        title:
          "Native filtering and pagination; custom include with a MongoDB prefix and application suffix",
        query: {
          select: {
            name: true,
            total: true,
            createdBy: { select: { displayName: true, initials: true } },
          },
          where: { total: { $gte: 30 } },
          page: { limit: 1 },
        },
      },
      {
        title:
          "A MongoDB leaf OR a custom application leaf, then paginate and load selected relations",
        query: {
          select: {
            name: true,
            products: {
              select: { name: true },
              orderBy: { stock: "desc" },
              page: { limit: 1 },
            },
          },
          where: {
            $or: [{ name: { $startsWith: "A" } }, { eligible: { $eq: true } }],
          },
          page: { offset: 1, limit: 2 },
        },
      },
      {
        title:
          "A backend-defined lookup predicate under NOT; application-derived ordering before pagination",
        query: {
          select: { displayName: true },
          where: { $not: { hasAvailableProducts: { $eq: true } } },
          orderBy: { displayName: "desc" },
          page: { limit: 2 },
        },
      },
    ] as const satisfies readonly {
      title: string;
      query: ReadQuery<typeof CategoryResource>;
    }[];
    for (const example of examples) {
      Object.assign(calls, { initials: 0, displayName: 0, eligible: 0 });
      console.log(`\n${example.title}`);
      console.log(
        JSON.stringify(
          { query: example.query, plan: getCategories.inspect(example.query) },
          null,
          2,
        ),
      );
      const result = await getCategories(example.query);
      console.log(JSON.stringify({ result, applicationCalls: calls }, null, 2));
    }
    const source = categorySource
      .load("stockInputs", relations.products.all({ select: { stock: true } }))
      .derive("stockTotal", ["stockInputs"], ({ stockInputs }) =>
        stockInputs.reduce((sum, product) => sum + product.stock, 0),
      );
    const read = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        stockTotal: field.number(),
        products: field.many(ProductResource),
      }),
      { source, relations: { products: relations.products } },
    );
    const query = {
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
    } as const;
    console.log(
      "\nA relation-derived total uses every product, independently of the displayed product page",
    );
    console.log(
      JSON.stringify(
        { query, plan: read.inspect(query), result: await read(query) },
        null,
        2,
      ),
    );
    const optimized = categorySource
      .load("count", relations.products.count())
      .load("exists", relations.products.exists())
      .load("sum", relations.products.sum({ field: "stock" }))
      .load("avg", relations.products.avg({ field: "stock" }))
      .load("min", relations.products.min({ field: "stock" }))
      .load("max", relations.products.max({ field: "stock" }))
      .load(
        "first",
        relations.products.first({
          select: { name: true },
          orderBy: { stock: "asc" },
        }),
      )
      .load(
        "last",
        relations.products.last({
          select: { name: true },
          orderBy: { stock: "asc" },
        }),
      )
      .derive("firstName", ["first"], (row) => row.first?.name ?? null)
      .derive("lastName", ["last"], (row) => row.last?.name ?? null);
    const statistics = defineRead(
      defineResource({
        name: field.string().filterable("$eq"),
        count: field.number(),
        exists: field.boolean(),
        sum: field.number(),
        avg: field.number().nullable(),
        min: field.number().nullable(),
        max: field.number().nullable(),
        firstName: field.string().nullable(),
        lastName: field.string().nullable(),
      }),
      { source: optimized },
    );
    const statisticsQuery = {
      select: {
        name: true,
        count: true,
        exists: true,
        sum: true,
        avg: true,
        min: true,
        max: true,
        firstName: true,
        lastName: true,
      },
      where: { name: { $eq: "Books" } },
    } as const;
    console.log("\nNative relation reductions and first/last selection");
    console.log(
      JSON.stringify(
        {
          query: statisticsQuery,
          plan: statistics.inspect(statisticsQuery),
          result: await statistics(statisticsQuery),
        },
        null,
        2,
      ),
    );
    const Stock = defineResource({ stock: field.number() });
    const summary = categorySource
      .related(productSource, {
        localField: "_id",
        foreignField: "category",
      })
      .native({
        stages: [{ $group: { _id: null, stock: { $sum: "$stock" } } }],
        output: schema.object({ stock: schema.number() }),
      })
      .one(Stock);
    const summarized = defineRead(
      defineResource({
        name: field.string().filterable("$in"),
        stockSummary: field.one(Stock).nullable(),
      }),
      {
        source: categorySource.filter(() => true),
        relations: { stockSummary: summary },
      },
    );
    const summaryQuery = {
      select: { name: true, stockSummary: { select: { stock: true } } },
      where: { name: { $in: ["Books", "Games"] } },
    } as const;
    console.log(
      "\nRelation-first native grouping keeps each parent's context during deferred execution",
    );
    console.log(
      JSON.stringify(
        {
          query: summaryQuery,
          plan: summarized.inspect(summaryQuery),
          result: await summarized(summaryQuery),
        },
        null,
        2,
      ),
    );
    let batchQueries = 0;
    const BatchSummary = defineResource({
      count: field.number(),
      stock: field.number(),
    });
    const batchSummary = categorySource.related({
      requires: ["_id"],
      output: schema.object({ count: schema.number(), stock: schema.number() }),
      resolveBatch: async ({ parents }) => {
        batchQueries++;
        const totals = await Products.aggregate<{
          _id: unknown;
          count: number;
          stock: number;
        }>([
          { $match: { category: { $in: parents.map(({ row }) => row._id) } } },
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
              stock: { $sum: "$stock" },
            },
          },
        ]);
        const byCategory = new Map(
          totals.map((total) => [String(total._id), total]),
        );
        return parents.map(({ ref, row }) => {
          const total = byCategory.get(String(row._id));
          return {
            ref,
            rows: [{ count: total?.count ?? 0, stock: total?.stock ?? 0 }],
          };
        });
      },
    });
    const batchRead = defineRead(
      defineResource({
        name: field.string().filterable("$in"),
        stockSummary: field.one(BatchSummary),
      }),
      {
        source: categorySource,
        relations: { stockSummary: batchSummary.one(BatchSummary) },
      },
    );
    const batchQuery = {
      ...summaryQuery,
      select: {
        name: true,
        stockSummary: { select: { count: true, stock: true } },
      },
    } as const;
    console.log(
      "\nresolveBatch combines count and sum for all selected parents in one custom MongoDB query",
    );
    console.log(
      JSON.stringify(
        {
          query: batchQuery,
          plan: batchRead.inspect(batchQuery),
          result: await batchRead(batchQuery),
          batchQueries,
        },
        null,
        2,
      ),
    );
    console.log(
      "\nA custom native field producer activates for selection or filtering and disappears when unused",
    );
    for (const query of [
      { select: { name: true }, where: { name: { $eq: "Books" } } },
      {
        select: { name: true, stockTotal: true, productCount: true },
        where: { name: { $eq: "Books" } },
      },
      { select: { name: true }, where: { stockTotal: { $gte: 1 } } },
    ] as const)
      console.log(
        JSON.stringify(
          {
            query,
            plan: readNativeStocks.inspect(query),
            result: await readNativeStocks(query),
          },
          null,
          2,
        ),
      );
  } finally {
    try {
      await mongoose.disconnect();
    } finally {
      await database.stop();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
