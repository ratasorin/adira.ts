import { type RequestContext } from "../../harness/telemetry";
import { AS_OF, DAY, SINCE } from "../clock";
import { Orders, type Id } from "../database/models";
import { base, byId, key } from "../database/records";
import { priority } from "../orders/rules";
import { volatility } from "./rules";

export async function referenceVolatility(accountId: Id, c: RequestContext) {
  const orders = await Orders.collection
    .find({ ...base(c), accountId, placedAt: { $gte: SINCE } })
    .project({ totalCents: 1, refundedCents: 1, placedAt: 1, status: 1 })
    .toArray();
  return {
    candidates: orders.length,
    value: volatility(orders.map((o) => o.totalCents - o.refundedCents)),
    priorityTop2: orders
      .map((o) => ({
        id: key(o._id),
        priority: priority(o.totalCents, o.status, (AS_OF - o.placedAt) / DAY),
      }))
      .sort((a, b) => b.priority - a.priority || byId(a, b))
      .slice(0, 2),
  };
}
