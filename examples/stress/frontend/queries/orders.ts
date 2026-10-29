import * as contracts from "../../contracts/resources";
import { deriveQuery, when } from "../controls/query";
import { collectionInputs } from "../controls/table-controls";
import * as inputs from "../generated/controls";
import * as dashboardFilters from "../generated/dashboard-filters";
import {
  accountMiniInputs,
  accountMiniQuery,
  lineInputs,
  lineQuery,
} from "./relations";

export function orderInputs(limit = 20) {
  return {
    ...collectionInputs<typeof contracts.OrderResource>(
      { ...inputs.OrderResourceColumns, id: true },
      limit,
    ),
    includeAccount: false,
    account: accountMiniInputs(),
    includeItems: false,
    items: lineInputs(5),
  };
}

export type OrderInputs = ReturnType<typeof orderInputs>;

export const orderQuery = deriveQuery(
  contracts.OrderResource,
  (values: OrderInputs) => {
    const where = dashboardFilters.OrderResourceFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        number: when(values.columns.number, () => true),
        status: when(values.columns.status, () => true),
        region: when(values.columns.region, () => true),
        placedAt: when(values.columns.placedAt, () => true),
        totalCents: when(values.columns.totalCents, () => true),
        netCents: when(values.columns.netCents, () => true),
        priority: when(values.columns.priority, () => true),
        shortageUnits: when(values.columns.shortageUnits, () => true),
        fulfillmentScore: when(values.columns.fulfillmentScore, () => true),
        account: when(values.includeAccount, () =>
          accountMiniQuery(values.account),
        ),
        items: when(values.includeItems, () => lineQuery(values.items)),
      },
      where,
      orderBy: values.orderBy,
      page: { limit: values.limit, offset: values.offset },
    };
  },
);
