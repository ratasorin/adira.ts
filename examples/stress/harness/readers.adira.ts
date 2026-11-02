import { type ReadQuery } from "@n/adira.core.ts";
import {
  AccountResource,
  OrderResource,
  ProductResource,
  type Entity,
} from "../contracts/resources";
import { readAccounts } from "../server/accounts/details.adira";
import { readOrders } from "../server/orders/details.adira";
import { readProducts } from "../server/products/details.adira";
import { type RequestContext } from "./telemetry";

export function inspect(
  entity: Entity,
  query: unknown,
  context: RequestContext,
) {
  if (entity === "accounts")
    return readAccounts.inspect(
      query as ReadQuery<typeof AccountResource>,
      context,
    );
  if (entity === "orders")
    return readOrders.inspect(
      query as ReadQuery<typeof OrderResource>,
      context,
    );
  return readProducts.inspect(
    query as ReadQuery<typeof ProductResource>,
    context,
  );
}

export function executeAdira(
  entity: Entity,
  query: unknown,
  context: RequestContext,
) {
  if (entity === "accounts")
    return readAccounts(query as ReadQuery<typeof AccountResource>, context);
  if (entity === "orders")
    return readOrders(query as ReadQuery<typeof OrderResource>, context);
  return readProducts(query as ReadQuery<typeof ProductResource>, context);
}

export type { FulfillmentLineIntermediate } from "../server/orders/items.adira";

export type { FulfillmentOrderIntermediate } from "../server/orders/fulfillment.adira";

export type { BatchedOrderIntermediate } from "../server/orders/fulfillment-batched.adira";

export type { FinanceIntermediate } from "../server/accounts/finance.adira";

export type { AccountIntermediate } from "../server/accounts/details.adira";

export { readAccounts } from "../server/accounts/details.adira";

export {
  executeBatchedOrders,
  inspectBatchedOrders,
  readOrdersBatched,
} from "../server/orders/fulfillment-batched.adira";

export { readOrders } from "../server/orders/details.adira";

export { readProducts } from "../server/products/details.adira";
