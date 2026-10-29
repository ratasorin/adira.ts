import { type PlanRow } from "@n/adira.backend.ts";
import { type ReadQuery } from "@n/adira.core.ts";
import { OrderResource, readLimits as limits } from "../../contracts/resources";
import { count, type RequestContext } from "../../harness/telemetry";
import { reads } from "../read-context";
import { orderRelations } from "./details.adira";
import { priorityNeeds, resolvePriority } from "./operations.adira";
import { fulfillmentScore } from "./rules";
import {
  ShortageSummary,
  loadOrderShortages,
  shortageOutput,
} from "./shortages.provider";
import { orderNative } from "./source.adira";

const batchedOrderBase = orderNative
  .toApp({ batchSize: 1024, concurrency: 8 })
  .derive("priority", priorityNeeds, resolvePriority);

const shortageSummary = batchedOrderBase
  .related({
    requires: ["_id"],
    output: shortageOutput,
    resolveBatch: loadOrderShortages,
  })
  .one(ShortageSummary);

const batchedOrderSource = batchedOrderBase
  .load(
    "shortageSummary",
    shortageSummary.get({ select: { shortageUnits: true } }),
  )
  .derive(
    "shortageUnits",
    ["shortageSummary"],
    (row) => row.shortageSummary?.shortageUnits ?? 0,
  )
  .derive("fulfillmentScore", ["priority", "shortageUnits"], (row, context) => {
    count(context, "fulfillmentScore");
    return fulfillmentScore(row.priority, row.shortageUnits);
  });

export type BatchedOrderIntermediate = PlanRow<typeof batchedOrderSource>;

export const readOrdersBatched = reads.defineRead(OrderResource, {
  source: batchedOrderSource,
  relations: orderRelations,
  limits,
});

export const executeBatchedOrders = (query: unknown, context: RequestContext) =>
  readOrdersBatched(query as ReadQuery<typeof OrderResource>, context);

export const inspectBatchedOrders = (query: unknown, context: RequestContext) =>
  readOrdersBatched.inspect(query as ReadQuery<typeof OrderResource>, context);
