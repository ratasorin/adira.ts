import type { ReadData } from "@n/adira.core.ts";
import type { OrderResource } from "../../contracts/resources";
import { count, type RequestContext } from "../../harness/telemetry";
import type { fulfillment } from "../../harness/workloads/advanced";
import { AS_OF, DAY } from "../clock";
import { Accounts, Orders, type Account, type Order } from "../database/models";
import { base, byObjectId as byId, key, unique } from "../database/records";
import { linesWithStock, nestedItems } from "./items.reference";
import { fulfillmentScore, orderPriority } from "./rules";

export async function referenceFulfillment(
  c: RequestContext,
): Promise<ReadData<typeof OrderResource, typeof fulfillment>> {
  const orders = await Orders.collection
    .find<Order>({
      ...base(c),
      region: { $in: ["EU", "NA"] },
      placedAt: { $gte: AS_OF - 30 * DAY },
      status: { $ne: "cancelled" },
    })
    .batchSize(10000)
    .toArray();
  const data = await linesWithStock(
    orders.map((o) => o._id),
    c,
  );
  const shortages = new Map<string, number>();
  for (const line of data.lines)
    shortages.set(
      key(line.orderId),
      (shortages.get(key(line.orderId)) ?? 0) + line.shortageUnits,
    );
  const chosen = orders
    .map((order) => {
      const shortageUnits = shortages.get(key(order._id)) ?? 0;
      const p = orderPriority(order);
      count(c, "priority");
      count(c, "fulfillmentScore");
      return {
        order,
        shortageUnits,
        priority: p,
        score: fulfillmentScore(p, shortageUnits),
      };
    })
    .filter((r) => (r.shortageUnits >= 1 && r.priority >= 55) || r.score >= 90)
    .sort((a, b) => b.score - a.score || byId(a.order, b.order))
    .slice(0, 20);
  const selectedIds = new Set(chosen.map((r) => key(r.order._id)));
  const [items, accounts] = await Promise.all([
    nestedItems(
      {
        ...data,
        lines: data.lines.filter((l) => selectedIds.has(key(l.orderId))),
      },
      c,
      "fulfillment",
    ),
    chosen.length
      ? Accounts.collection
          .find<Account>(
            {
              ...base(c),
              _id: { $in: unique(chosen.map((r) => r.order.accountId)) },
            },
            { projection: { _id: 1, name: 1 } },
          )
          .toArray()
      : Promise.resolve([]),
  ]);
  const accountMap = new Map(accounts.map((a) => [key(a._id), a]));
  return {
    rows: chosen.map((r) => ({
      id: key(r.order._id),
      number: r.order.number,
      priority: r.priority,
      shortageUnits: r.shortageUnits,
      fulfillmentScore: r.score,
      account: accountMap.has(key(r.order.accountId))
        ? { name: accountMap.get(key(r.order.accountId))!.name }
        : null,
      items: items.get(key(r.order._id)) ?? [],
    })),
  };
}
