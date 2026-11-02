import { type PlanRow } from "@n/adira.backend.ts";
import { LineResource } from "../../contracts/resources";
import { count } from "../../harness/telemetry";
import { product } from "../products/relations.adira";
import { itemNative } from "./items.adira";
import { orderBase } from "./operations.adira";
import { fulfillmentScore } from "./rules";

const fulfillmentItems = orderBase
  .related(itemNative, { localField: "_id", foreignField: "orderId" })
  .many(LineResource, { relations: { product } });

export const orderSource = orderBase
  .load("shortageUnits", fulfillmentItems.sum({ field: "shortageUnits" }))
  .derive("fulfillmentScore", ["priority", "shortageUnits"], (row, context) => {
    count(context, "fulfillmentScore");
    return fulfillmentScore(row.priority, row.shortageUnits);
  });

export type FulfillmentOrderIntermediate = PlanRow<typeof orderSource>;
