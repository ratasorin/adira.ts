import * as contracts from "../../contracts/resources";
import { deriveQuery, when } from "../controls/query";
import { collectionInputs } from "../controls/table-controls";
import * as inputs from "../generated/controls";
import * as dashboardFilters from "../generated/dashboard-filters";
import { inventoryInputs, inventoryQuery } from "./relations";

export function productInputs(limit = 20) {
  return {
    ...collectionInputs<typeof contracts.ProductResource>(
      { ...inputs.ProductResourceColumns, id: true },
      limit,
    ),
    includeInventory: false,
    inventory: inventoryInputs(5),
  };
}

export type ProductInputs = ReturnType<typeof productInputs>;

export const productQuery = deriveQuery(
  contracts.ProductResource,
  (values: ProductInputs) => {
    const where = dashboardFilters.ProductResourceFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        name: when(values.columns.name, () => true),
        sku: when(values.columns.sku, () => true),
        category: when(values.columns.category, () => true),
        active: when(values.columns.active, () => true),
        available: when(values.columns.available, () => true),
        unitsSold: when(values.columns.unitsSold, () => true),
        warehouseCount: when(values.columns.warehouseCount, () => true),
        daysCover: when(values.columns.daysCover, () => true),
        inventory: when(values.includeInventory, () =>
          inventoryQuery(values.inventory),
        ),
      },
      where,
      orderBy: values.orderBy,
      page: { limit: values.limit, offset: values.offset },
    };
  },
);
