import {
  AccountMini,
  LineResource,
  OrderResource,
  readLimits as limits,
} from "../../contracts/resources";
import { accountNative } from "../accounts/source.adira";
import { product } from "../products/relations.adira";
import { reads } from "../read-context";
import { orderSource } from "./fulfillment.adira";
import { itemNative } from "./items.adira";

export const orderRelations = {
  items: orderSource
    .related(itemNative, { localField: "_id", foreignField: "orderId" })
    .many(LineResource, { relations: { product } }),
  account: orderSource
    .related(accountNative, { localField: "accountId", foreignField: "_id" })
    .one(AccountMini),
};

export const readOrders = reads.defineRead(OrderResource, {
  source: orderSource,
  relations: orderRelations,
  limits,
});
