import * as contracts from "../../contracts/resources";
import { defineScreen } from "../controls/screen";
import * as inputs from "../generated/controls";
import * as queries from "../queries";
import { bindAccount } from "./accounts";
import { bindOrder } from "./orders";
import { bindProduct } from "./products";

export const screens = {
  accounts: defineScreen(
    contracts.AccountResource,
    (): queries.AccountInputs => ({
      ...queries.accountInputs(),
      columns: {
        ...inputs.AccountResourceColumns,
        id: true,
        name: true,
        region: true,
        tier: true,
      },
    }),
  )({
    entity: "accounts",
    title: "Accounts",
    query: queries.accountQuery,
    bind: bindAccount,
  }),
  orders: defineScreen(
    contracts.OrderResource,
    (): queries.OrderInputs => ({
      ...queries.orderInputs(),
      columns: {
        ...inputs.OrderResourceColumns,
        id: true,
        number: true,
        status: true,
        region: true,
        totalCents: true,
      },
    }),
  )({
    entity: "orders",
    title: "Orders",
    query: queries.orderQuery,
    bind: bindOrder,
  }),
  products: defineScreen(
    contracts.ProductResource,
    (): queries.ProductInputs => ({
      ...queries.productInputs(),
      columns: {
        ...inputs.ProductResourceColumns,
        id: true,
        name: true,
        sku: true,
        category: true,
        active: true,
      },
    }),
  )({
    entity: "products",
    title: "Products",
    query: queries.productQuery,
    bind: bindProduct,
  }),
};

export type {
  AccountMiniRow,
  AgentRow,
  InventoryRow,
  LineRow,
  ProductMiniRow,
  ShipmentRow,
  TicketRow,
} from "./relations";

export {
  bindAccountMini,
  bindAgent,
  bindInventory,
  bindLine,
  bindProductMini,
  bindShipment,
  bindTicket,
} from "./relations";

export type { OrderRow } from "./orders";

export { bindOrder } from "./orders";

export type { AccountRow } from "./accounts";

export { bindAccount } from "./accounts";

export type { ProductRow } from "./products";

export { bindProduct } from "./products";
