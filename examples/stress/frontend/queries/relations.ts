import * as contracts from "../../contracts/resources";
import { deriveQuery, when } from "../controls/query";
import { collectionInputs, selectionInputs } from "../controls/table-controls";
import * as inputs from "../generated/controls";
import * as dashboardFilters from "../generated/dashboard-filters";

export function agentInputs() {
  return selectionInputs<typeof contracts.AgentResource>({
    ...inputs.AgentResourceColumns,
    id: true,
  });
}

export type AgentInputs = ReturnType<typeof agentInputs>;

export const agentQuery = deriveQuery(
  contracts.AgentResource,
  (values: AgentInputs) => {
    const where = dashboardFilters.AgentResourceFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        name: when(values.columns.name, () => true),
        region: when(values.columns.region, () => true),
      },
      where,
    };
  },
);

export function accountMiniInputs() {
  return selectionInputs<typeof contracts.AccountMini>({
    ...inputs.AccountMiniColumns,
    id: true,
  });
}

export type AccountMiniInputs = ReturnType<typeof accountMiniInputs>;

export const accountMiniQuery = deriveQuery(
  contracts.AccountMini,
  (values: AccountMiniInputs) => {
    const where = dashboardFilters.AccountMiniFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        name: when(values.columns.name, () => true),
        region: when(values.columns.region, () => true),
      },
      where,
    };
  },
);

export function inventoryInputs(limit = 20) {
  return collectionInputs<typeof contracts.InventoryResource>(
    { ...inputs.InventoryResourceColumns, id: true },
    limit,
  );
}

export type InventoryInputs = ReturnType<typeof inventoryInputs>;

export const inventoryQuery = deriveQuery(
  contracts.InventoryResource,
  (values: InventoryInputs) => {
    const where = dashboardFilters.InventoryResourceFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        warehouse: when(values.columns.warehouse, () => true),
        onHand: when(values.columns.onHand, () => true),
        reserved: when(values.columns.reserved, () => true),
        available: when(values.columns.available, () => true),
        stockStatus: when(values.columns.stockStatus, () => true),
      },
      where,
      orderBy: values.orderBy,
      page: { limit: values.limit, offset: values.offset },
    };
  },
);

export function productMiniInputs() {
  return {
    ...selectionInputs<typeof contracts.ProductMini>({
      ...inputs.ProductMiniColumns,
      id: true,
    }),
    includeInventory: false,
    inventory: inventoryInputs(5),
  };
}

export type ProductMiniInputs = ReturnType<typeof productMiniInputs>;

export const productMiniQuery = deriveQuery(
  contracts.ProductMini,
  (values: ProductMiniInputs) => {
    const where = dashboardFilters.ProductMiniFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        name: when(values.columns.name, () => true),
        sku: when(values.columns.sku, () => true),
        inventory: when(values.includeInventory, () =>
          inventoryQuery(values.inventory),
        ),
      },
      where,
    };
  },
);

export function lineInputs(limit = 20) {
  return {
    ...collectionInputs<typeof contracts.LineResource>(
      { ...inputs.LineResourceColumns, id: true },
      limit,
    ),
    includeProduct: false,
    product: productMiniInputs(),
  };
}

export type LineInputs = ReturnType<typeof lineInputs>;

export const lineQuery = deriveQuery(
  contracts.LineResource,
  (values: LineInputs) => {
    const where = dashboardFilters.LineResourceFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        quantity: when(values.columns.quantity, () => true),
        grossCents: when(values.columns.grossCents, () => true),
        marginCents: when(values.columns.marginCents, () => true),
        shortageUnits: when(values.columns.shortageUnits, () => true),
        placedAt: when(values.columns.placedAt, () => true),
        status: when(values.columns.status, () => true),
        product: when(values.includeProduct, () =>
          productMiniQuery(values.product),
        ),
      },
      where,
      orderBy: values.orderBy,
      page: { limit: values.limit, offset: values.offset },
    };
  },
);

export function ticketInputs(limit = 20) {
  return collectionInputs<typeof contracts.TicketResource>(
    { ...inputs.TicketResourceColumns, id: true },
    limit,
  );
}

export type TicketInputs = ReturnType<typeof ticketInputs>;

export const ticketQuery = deriveQuery(
  contracts.TicketResource,
  (values: TicketInputs) => {
    const where = dashboardFilters.TicketResourceFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        subject: when(values.columns.subject, () => true),
        status: when(values.columns.status, () => true),
        priority: when(values.columns.priority, () => true),
        openedAt: when(values.columns.openedAt, () => true),
      },
      where,
      orderBy: values.orderBy,
      page: { limit: values.limit, offset: values.offset },
    };
  },
);

export function shipmentInputs(limit = 20) {
  return collectionInputs<typeof contracts.ShipmentResource>(
    { ...inputs.ShipmentResourceColumns, id: true },
    limit,
  );
}

export type ShipmentInputs = ReturnType<typeof shipmentInputs>;

export const shipmentQuery = deriveQuery(
  contracts.ShipmentResource,
  (values: ShipmentInputs) => {
    const where = dashboardFilters.ShipmentResourceFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        late: when(values.columns.late, () => true),
      },
      where,
      orderBy: values.orderBy,
      page: { limit: values.limit, offset: values.offset },
    };
  },
);
