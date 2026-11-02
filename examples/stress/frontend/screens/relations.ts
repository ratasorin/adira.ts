import type { ReadData } from "@n/adira.core.ts";
import * as contracts from "../../contracts/resources";
import { when } from "../controls/query";
import {
  appendColumns,
  bindCollection,
  bindSelection,
  columnsFor,
  includeControl,
} from "../controls/table-controls";
import * as dashboardFilters from "../generated/dashboard-filters";
import * as queries from "../queries";

export type AgentRow = ReadData<
  typeof contracts.AgentResource,
  ReturnType<typeof queries.agentQuery>
>["rows"][number];

const agentColumn = columnsFor<typeof contracts.AgentResource, AgentRow>();

const agentColumns = [
  agentColumn.value("id"),
  agentColumn.value("name"),
  agentColumn.value("region"),
];

export function bindAgent(
  values: queries.AgentInputs,
  update: (values: queries.AgentInputs) => void,
) {
  const bound = bindSelection(
    agentColumns,
    dashboardFilters.AgentResourceFilterEditors,
    values,
    update,
    [],
  );
  return bound;
}

export type AccountMiniRow = ReadData<
  typeof contracts.AccountMini,
  ReturnType<typeof queries.accountMiniQuery>
>["rows"][number];

const accountMiniColumn = columnsFor<
  typeof contracts.AccountMini,
  AccountMiniRow
>();

const accountMiniColumns = [
  accountMiniColumn.value("id"),
  accountMiniColumn.value("name"),
  accountMiniColumn.value("region"),
];

export function bindAccountMini(
  values: queries.AccountMiniInputs,
  update: (values: queries.AccountMiniInputs) => void,
) {
  const bound = bindSelection(
    accountMiniColumns,
    dashboardFilters.AccountMiniFilterEditors,
    values,
    update,
    [],
  );
  return bound;
}

export type InventoryRow = ReadData<
  typeof contracts.InventoryResource,
  ReturnType<typeof queries.inventoryQuery>
>["rows"][number];

const inventoryColumn = columnsFor<
  typeof contracts.InventoryResource,
  InventoryRow
>();

const inventoryColumns = [
  inventoryColumn.sortable("id", (direction) => ({ id: direction })),
  inventoryColumn.sortable("warehouse", (direction) => ({
    warehouse: direction,
  })),
  inventoryColumn.sortable("onHand", (direction) => ({ onHand: direction })),
  inventoryColumn.sortable("reserved", (direction) => ({
    reserved: direction,
  })),
  inventoryColumn.sortable("available", (direction) => ({
    available: direction,
  })),
  inventoryColumn.sortable("stockStatus", (direction) => ({
    stockStatus: direction,
  })),
];

export function bindInventory(
  values: queries.InventoryInputs,
  update: (values: queries.InventoryInputs) => void,
) {
  const bound = bindCollection(
    inventoryColumns,
    dashboardFilters.InventoryResourceFilterEditors,
    values,
    update,
    [],
  );
  return bound;
}

export type ProductMiniRow = ReadData<
  typeof contracts.ProductMini,
  ReturnType<typeof queries.productMiniQuery>
>["rows"][number];

const productMiniColumn = columnsFor<
  typeof contracts.ProductMini,
  ProductMiniRow
>();

const productMiniColumns = [
  productMiniColumn.value("id"),
  productMiniColumn.value("name"),
  productMiniColumn.value("sku"),
];

export function bindProductMini(
  values: queries.ProductMiniInputs,
  update: (values: queries.ProductMiniInputs) => void,
) {
  const bound = bindSelection(
    productMiniColumns,
    dashboardFilters.ProductMiniFilterEditors,
    values,
    update,
    [
      includeControl({
        key: "inventory",
        many: true,
        selected: values.includeInventory,
        toggle: () =>
          update({ ...values, includeInventory: !values.includeInventory }),
        child: values.includeInventory
          ? bindInventory(values.inventory, (next) =>
              update({ ...values, inventory: next }),
            )
          : undefined,
      }),
    ],
  );
  return bound;
}

export type LineRow = ReadData<
  typeof contracts.LineResource,
  ReturnType<typeof queries.lineQuery>
>["rows"][number];

const lineColumn = columnsFor<typeof contracts.LineResource, LineRow>();

const lineColumns = [
  lineColumn.sortable("id", (direction) => ({ id: direction })),
  lineColumn.sortable("quantity", (direction) => ({ quantity: direction })),
  lineColumn.sortable("grossCents", (direction) => ({ grossCents: direction })),
  lineColumn.sortable("marginCents", (direction) => ({
    marginCents: direction,
  })),
  lineColumn.sortable("shortageUnits", (direction) => ({
    shortageUnits: direction,
  })),
  lineColumn.sortable("placedAt", (direction) => ({ placedAt: direction })),
  lineColumn.sortable("status", (direction) => ({ status: direction })),
];

export function bindLine(
  values: queries.LineInputs,
  update: (values: queries.LineInputs) => void,
) {
  const bound = bindCollection(
    lineColumns,
    dashboardFilters.LineResourceFilterEditors,
    values,
    update,
    [
      includeControl({
        key: "product",
        many: false,
        selected: values.includeProduct,
        toggle: () =>
          update({
            ...values,
            includeProduct: !values.includeProduct,
            offset: 0,
          }),
        child: values.includeProduct
          ? bindProductMini(values.product, (next) =>
              update({ ...values, product: next, offset: 0 }),
            )
          : undefined,
      }),
    ],
  );
  return appendColumns(
    bound,
    when(values.includeProduct, () => lineColumn.relation("product")),
  );
}

export type TicketRow = ReadData<
  typeof contracts.TicketResource,
  ReturnType<typeof queries.ticketQuery>
>["rows"][number];

const ticketColumn = columnsFor<typeof contracts.TicketResource, TicketRow>();

const ticketColumns = [
  ticketColumn.sortable("id", (direction) => ({ id: direction })),
  ticketColumn.sortable("subject", (direction) => ({ subject: direction })),
  ticketColumn.sortable("status", (direction) => ({ status: direction })),
  ticketColumn.sortable("priority", (direction) => ({ priority: direction })),
  ticketColumn.sortable("openedAt", (direction) => ({ openedAt: direction })),
];

export function bindTicket(
  values: queries.TicketInputs,
  update: (values: queries.TicketInputs) => void,
) {
  const bound = bindCollection(
    ticketColumns,
    dashboardFilters.TicketResourceFilterEditors,
    values,
    update,
    [],
  );
  return bound;
}

export type ShipmentRow = ReadData<
  typeof contracts.ShipmentResource,
  ReturnType<typeof queries.shipmentQuery>
>["rows"][number];

const shipmentColumn = columnsFor<
  typeof contracts.ShipmentResource,
  ShipmentRow
>();

const shipmentColumns = [
  shipmentColumn.sortable("id", (direction) => ({ id: direction })),
  shipmentColumn.value("late"),
];

export function bindShipment(
  values: queries.ShipmentInputs,
  update: (values: queries.ShipmentInputs) => void,
) {
  const bound = bindCollection(
    shipmentColumns,
    dashboardFilters.ShipmentResourceFilterEditors,
    values,
    update,
    [],
  );
  return bound;
}
