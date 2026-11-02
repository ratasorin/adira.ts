import { count, type RequestContext } from "../../harness/telemetry";
import { AS_OF, DAY } from "../clock";
import { type Order } from "../database/models";
import { priority } from "./rules";
import { orderNative } from "./source.adira";

export const priorityNeeds = ["totalCents", "status", "placedAt"] as const;

export function resolvePriority(
  row: Pick<Order, (typeof priorityNeeds)[number]>,
  context: RequestContext,
) {
  count(context, "priority");
  return priority(row.totalCents, row.status, (AS_OF - row.placedAt) / DAY);
}

export const orderBase = orderNative
  .toApp({ batchSize: 128, concurrency: 8 })
  .derive("priority", priorityNeeds, resolvePriority);
