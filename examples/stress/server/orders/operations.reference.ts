import { count, type RequestContext } from "../../harness/telemetry";
import { AS_OF, DAY } from "../clock";
import { Orders, type Order } from "../database/models";
import { base, byId, key } from "../database/records";
import { nestedOrders } from "./details.reference";
import { priority } from "./rules";

export async function referenceOrderOperations(c: RequestContext) {
  const candidates = await Orders.collection
    .find<Order>({
      ...base(c),
      region: "EU",
      placedAt: { $gte: AS_OF - 30 * DAY },
      status: { $ne: "cancelled" },
    })
    .toArray();
  const chosen = candidates
    .map((row) => {
      count(c, "priority");
      return {
        ...row,
        id: key(row._id),
        priority: priority(
          row.totalCents,
          row.status,
          (AS_OF - row.placedAt) / DAY,
        ),
      };
    })
    .filter((row) => row.status === "pending" || row.priority >= 65)
    .sort((a, b) => b.priority - a.priority || byId(a, b))
    .slice(0, 20);
  return { rows: await nestedOrders(chosen, c, true) };
}
