import { count, type RequestContext } from "../../harness/telemetry";
import { SINCE } from "../clock";
import {
  Inventories,
  Lines,
  Products,
  type Id,
  type Product,
} from "../database/models";
import { base, byId, key } from "../database/records";
import { inventoryMap } from "./inventory.reference";
import { daysCover } from "./rules";

export async function replenishment(c: RequestContext) {
  const products = await Products.collection
    .find<Product>({ ...base(c), category: "hardware", active: true })
    .toArray();
  if (!products.length) return { rows: [] };
  const ids = products.map((p) => p._id);
  const [stock, sold] = await Promise.all([
    Inventories.collection
      .aggregate<{
        _id: Id;
        available: number;
        count: number;
      }>([
        { $match: { ...base(c), productId: { $in: ids } } },
        {
          $group: {
            _id: "$productId",
            available: { $sum: { $subtract: ["$onHand", "$reserved"] } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    Lines.collection
      .aggregate<{
        _id: Id;
        sold: number;
      }>([
        {
          $match: {
            ...base(c),
            productId: { $in: ids },
            placedAt: { $gte: SINCE },
            status: { $in: ["paid", "shipped"] },
          },
        },
        { $group: { _id: "$productId", sold: { $sum: "$quantity" } } },
      ])
      .toArray(),
  ]);
  const stockMap = new Map(stock.map((r) => [key(r._id), r])),
    soldMap = new Map(sold.map((r) => [key(r._id), r.sold]));
  const candidates = products.map((p) => {
    const id = key(p._id),
      value = stockMap.get(id),
      unitsSold = soldMap.get(id) ?? 0,
      available = value?.available ?? 0;
    count(c, "daysCover");
    return {
      id,
      name: p.name,
      sku: p.sku,
      available,
      unitsSold,
      warehouseCount: value?.count ?? 0,
      daysCover: daysCover(available, unitsSold),
      _id: p._id,
    };
  });
  const selectedRows = candidates
    .filter((p) => p.daysCover < 60 || p.available < 0)
    .sort((a, b) => a.daysCover - b.daysCover || byId(a, b))
    .slice(0, 25);
  const warehouses = await inventoryMap(
    selectedRows.map((p) => p._id),
    c,
    true,
  );
  return {
    rows: selectedRows.map(({ _id, ...row }) => ({
      ...row,
      inventory: (warehouses.get(row.id) ?? []).slice(0, 2),
    })),
  };
}
