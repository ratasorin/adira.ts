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
import { bindAccountMini, bindLine } from "./relations";

export type OrderRow = ReadData<
  typeof contracts.OrderResource,
  ReturnType<typeof queries.orderQuery>
>["rows"][number];

const orderColumn = columnsFor<typeof contracts.OrderResource, OrderRow>();

const orderColumns = [
  orderColumn.sortable("id", (direction) => ({ id: direction })),
  orderColumn.sortable("number", (direction) => ({ number: direction })),
  orderColumn.sortable("status", (direction) => ({ status: direction })),
  orderColumn.sortable("region", (direction) => ({ region: direction })),
  orderColumn.sortable("placedAt", (direction) => ({ placedAt: direction })),
  orderColumn.sortable("totalCents", (direction) => ({
    totalCents: direction,
  })),
  orderColumn.sortable("netCents", (direction) => ({ netCents: direction })),
  orderColumn.sortable("priority", (direction) => ({ priority: direction })),
  orderColumn.sortable("shortageUnits", (direction) => ({
    shortageUnits: direction,
  })),
  orderColumn.sortable("fulfillmentScore", (direction) => ({
    fulfillmentScore: direction,
  })),
];

export function bindOrder(
  values: queries.OrderInputs,
  update: (values: queries.OrderInputs) => void,
) {
  const bound = bindCollection(
    orderColumns,
    dashboardFilters.OrderResourceFilterEditors,
    values,
    update,
    [
      includeControl({
        key: "account",
        many: false,
        selected: values.includeAccount,
        toggle: () =>
          update({
            ...values,
            includeAccount: !values.includeAccount,
            offset: 0,
          }),
        child: values.includeAccount
          ? bindAccountMini(values.account, (next) =>
              update({ ...values, account: next, offset: 0 }),
            )
          : undefined,
      }),
      includeControl({
        key: "items",
        many: true,
        selected: values.includeItems,
        toggle: () =>
          update({ ...values, includeItems: !values.includeItems, offset: 0 }),
        child: values.includeItems
          ? bindLine(values.items, (next) =>
              update({ ...values, items: next, offset: 0 }),
            )
          : undefined,
      }),
    ],
  );
  return appendColumns(
    bound,
    when(values.includeAccount, () => orderColumn.relation("account")),
    when(values.includeItems, () => orderColumn.relation("items")),
  );
}
