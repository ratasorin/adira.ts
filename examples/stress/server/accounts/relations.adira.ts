import {
  AgentResource,
  OrderResource,
  ShipmentResource,
  TicketResource,
  readLimits as limits,
} from "../../contracts/resources";
import { orderRelations } from "../orders/details.adira";
import { orderSource } from "../orders/fulfillment.adira";
import { agentSource, shipmentSource, ticketSource } from "./service.adira";
import { accountNative } from "./source.adira";

export const orders = accountNative
  .related(orderSource, { localField: "_id", foreignField: "accountId" })
  .many(OrderResource, {
    relations: orderRelations,
    limits: { ...limits, maxCandidates: 400 },
  });

export const tickets = accountNative
  .related(ticketSource, { localField: "_id", foreignField: "accountId" })
  .many(TicketResource);

export const shipments = accountNative
  .related(shipmentSource, { localField: "_id", foreignField: "accountId" })
  .many(ShipmentResource);

export const manager = accountNative
  .related(agentSource, { localField: "managerId", foreignField: "_id" })
  .one(AgentResource);
