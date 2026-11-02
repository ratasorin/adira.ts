import { InventoryResource } from "../../contracts/resources";
import { count } from "../../harness/telemetry";
import { Inventories } from "../database/models";
import { reads } from "../read-context";
import { stockStatus } from "./rules";
import { productNative } from "./source.adira";

export const inventorySource = reads.mongo
  .from(Inventories, {
    scope: (e, c) =>
      e.and(
        e.eq(e.field("tenantId"), c.tenantId),
        e.isNull(e.field("deletedAt")),
      ),
  })
  .derive("id", (e) => e.toString(e.field("_id")))
  .derive("available", (e) =>
    e.add(e.field("onHand"), e.multiply(e.field("reserved"), e.literal(-1))),
  )
  .toApp({ batchSize: 128, concurrency: 8 })
  .derive("stockStatus", ["available"], (row, c) => {
    count(c, "stockStatus");
    return stockStatus(row.available);
  });

export const inventory = productNative
  .related(inventorySource, { localField: "_id", foreignField: "productId" })
  .many(InventoryResource);
