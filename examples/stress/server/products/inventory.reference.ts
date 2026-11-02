import { count, type RequestContext } from "../../harness/telemetry";
import { Inventories, type Id, type Inventory } from "../database/models";
import { base, key } from "../database/records";
import { stockStatus } from "./rules";

export async function inventoryMap(
  productIds: Id[],
  c: RequestContext,
  full: boolean,
) {
  if (!productIds.length) return new Map<string, Record<string, unknown>[]>();
  const rows = await Inventories.collection
    .find<Inventory>({ ...base(c), productId: { $in: productIds } })
    .sort({ warehouse: 1, _id: 1 })
    .toArray();
  const result = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const id = key(row.productId),
      available = row.onHand - row.reserved;
    count(c, "stockStatus");
    const value = full
      ? {
          warehouse: row.warehouse,
          onHand: row.onHand,
          reserved: row.reserved,
          stockStatus: stockStatus(available),
        }
      : {
          warehouse: row.warehouse,
          available,
          stockStatus: stockStatus(available),
        };
    const list = result.get(id) ?? [];
    list.push(value);
    result.set(id, list);
  }
  return result;
}
