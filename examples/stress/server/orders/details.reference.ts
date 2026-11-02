import { count, type RequestContext } from "../../harness/telemetry";
import { AS_OF, DAY } from "../clock";
import {
  Accounts,
  Lines,
  Products,
  type Account,
  type Order,
  type Product,
} from "../database/models";
import { base, key } from "../database/records";
import { inventoryMap } from "../products/inventory.reference";
import { priority } from "./rules";

export async function nestedOrders(
  rows: Order[],
  c: RequestContext,
  withAccount: boolean,
) {
  if (!rows.length) return [];
  const items = await Lines.collection
    .aggregate<
      import("../database/models").Line
    >([{ $match: { ...base(c), orderId: { $in: rows.map((r) => r._id) } } }, { $setWindowFields: { partitionBy: "$orderId", sortBy: { _id: 1 }, output: { _rank: { $documentNumber: {} } } } }, { $match: { _rank: { $lte: 2 } } }])
    .toArray();
  const productIds = [
    ...new Map(items.map((i) => [key(i.productId), i.productId])).values(),
  ];
  const [products, warehouses, accounts] = await Promise.all([
    Products.collection
      .find<Product>({ ...base(c), _id: { $in: productIds } })
      .toArray(),
    inventoryMap(productIds, c, false),
    withAccount
      ? Accounts.collection
          .find<Account>({
            ...base(c),
            _id: { $in: rows.map((r) => r.accountId) },
          })
          .toArray()
      : Promise.resolve([]),
  ]);
  const productMap = new Map(products.map((p) => [key(p._id), p])),
    accountMap = new Map(accounts.map((a) => [key(a._id), a]));
  return rows.map((row) => {
    count(c, "priority");
    const acct = accountMap.get(key(row.accountId));
    const children = items
      .filter((i) => key(i.orderId) === key(row._id))
      .sort((a, b) => key(a._id).localeCompare(key(b._id)))
      .map((item) => {
        const prod = productMap.get(key(item.productId));
        return {
          quantity: item.quantity,
          marginCents: item.grossCents - item.costCents,
          product: prod
            ? {
                sku: prod.sku,
                inventory: (warehouses.get(key(prod._id)) ?? []).slice(0, 2),
              }
            : null,
        };
      });
    const common = {
      id: key(row._id),
      number: row.number,
      netCents: row.totalCents - row.refundedCents,
      priority: priority(
        row.totalCents,
        row.status,
        (AS_OF - row.placedAt) / DAY,
      ),
      items: children,
    };
    return withAccount
      ? {
          ...common,
          status: row.status,
          account: acct ? { name: acct.name, region: acct.region } : null,
        }
      : common;
  });
}
