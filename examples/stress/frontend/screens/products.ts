import type { ReadData } from "@n/adira.core.ts";
import * as contracts from "../../contracts/resources";
import { when } from "../controls/query";
import {
  appendColumns,
  bindCollection,
  columnsFor,
  includeControl,
} from "../controls/table-controls";
import * as dashboardFilters from "../generated/dashboard-filters";
import * as queries from "../queries";
import { bindInventory } from "./relations";

export type ProductRow = ReadData<
  typeof contracts.ProductResource,
  ReturnType<typeof queries.productQuery>
>["rows"][number];

const productColumn = columnsFor<
  typeof contracts.ProductResource,
  ProductRow
>();

const productColumns = [
  productColumn.sortable("id", (direction) => ({ id: direction })),
  productColumn.sortable("name", (direction) => ({ name: direction })),
  productColumn.sortable("sku", (direction) => ({ sku: direction })),
  productColumn.sortable("category", (direction) => ({ category: direction })),
  productColumn.value("active"),
  productColumn.sortable("available", (direction) => ({
    available: direction,
  })),
  productColumn.sortable("unitsSold", (direction) => ({
    unitsSold: direction,
  })),
  productColumn.sortable("warehouseCount", (direction) => ({
    warehouseCount: direction,
  })),
  productColumn.sortable("daysCover", (direction) => ({
    daysCover: direction,
  })),
];

export function bindProduct(
  values: queries.ProductInputs,
  update: (values: queries.ProductInputs) => void,
) {
  const bound = bindCollection(
    productColumns,
    dashboardFilters.ProductResourceFilterEditors,
    values,
    update,
    [
      includeControl({
        key: "inventory",
        many: true,
        selected: values.includeInventory,
        toggle: () =>
          update({
            ...values,
            includeInventory: !values.includeInventory,
            offset: 0,
          }),
        child: values.includeInventory
          ? bindInventory(values.inventory, (next) =>
              update({ ...values, inventory: next, offset: 0 }),
            )
          : undefined,
      }),
    ],
  );
  return appendColumns(
    bound,
    when(values.includeInventory, () => productColumn.relation("inventory")),
  );
}
