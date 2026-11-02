import { LineResource } from "../../contracts/resources";
import { count } from "../../harness/telemetry";
import { SINCE } from "../clock";
import { itemNative } from "../orders/items.adira";
import { finiteNumber } from "../read-context";
import { product } from "./relations.adira";
import { daysCover } from "./rules";
import { productNative } from "./source.adira";
import { Stock, loadStock, stockOutput } from "./stock.provider";

const sold = productNative
  .related(itemNative, { localField: "_id", foreignField: "productId" })
  .many(LineResource, { relations: { product } });

const stock = productNative
  .related({
    requires: ["_id"],
    output: stockOutput,
    resolveBatch: loadStock,
  })
  .one(Stock);

export const productSource = productNative
  .toApp({ batchSize: 128, concurrency: 8 })
  .load(
    "stock",
    stock.get({
      select: {
        onHand: true,
        reserved: true,
        warehouseCount: true,
      },
    }),
  )
  .derive("available", ["stock"], (row) =>
    finiteNumber.parse((row.stock?.onHand ?? 0) - (row.stock?.reserved ?? 0)),
  )
  .derive("warehouseCount", ["stock"], (row) => row.stock?.warehouseCount ?? 0)
  .load(
    "unitsSold",
    sold.sum({
      field: "quantity",
      where: {
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
    }),
  )
  .derive("daysCover", ["available", "unitsSold"], (r, c) => {
    count(c, "daysCover");
    return daysCover(r.available, r.unitsSold);
  });
