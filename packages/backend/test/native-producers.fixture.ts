import { defineResource, field, schema } from "@n/adira.core.ts";
import { defineRead, mongo, type PlanRow } from "../read";
import { Categories, Products } from "./fixtures";

// A custom lookup computes both summaries once whenever either output is needed.
export const nativeStockSource = mongo
  .from(Categories, {
    scope: (e) => e.eq(e.field("tenant"), "demo"),
  })
  .derive("stockJoinKey", (e) => e.field("_id"))
  .native({
    provides: ["stockTotal", "productCount"],
    requires: ["stockJoinKey"],
    stages: [
      {
        $lookup: {
          from: Products.collection.name,
          localField: "stockJoinKey",
          foreignField: "category",
          pipeline: [
            // Foreign-input policies remain explicit in custom pipelines.
            { $match: { isActive: true } },
            {
              $group: {
                _id: null,
                total: { $sum: "$stock" },
                count: { $sum: 1 },
              },
            },
          ],
          as: "_stockSummary",
        },
      },
      {
        $set: {
          stockTotal: {
            $ifNull: [{ $arrayElemAt: ["$_stockSummary.total", 0] }, 0],
          },
          productCount: {
            $ifNull: [{ $arrayElemAt: ["$_stockSummary.count", 0] }, 0],
          },
        },
      },
      { $unset: "_stockSummary" },
    ],
    output: schema.object({
      stockTotal: schema.number(),
      productCount: schema.number(),
    }),
  });

export type NativeStockRow = PlanRow<typeof nativeStockSource>;
// Category fields remain available; stockTotal and productCount are numbers.
export const NativeStockResource = defineResource({
  name: field.string().filterable("$eq", "$in").orderable(),
  stockTotal: field.number().filterable("$gte").orderable(),
  productCount: field.number().filterable("$gte"),
});
export const readNativeStocks = defineRead(NativeStockResource, {
  source: nativeStockSource,
  defaultOrderBy: { name: "asc" },
});
