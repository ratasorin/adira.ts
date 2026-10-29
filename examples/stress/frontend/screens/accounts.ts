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
import { bindOrder } from "./orders";
import { bindAgent, bindTicket } from "./relations";

export type AccountRow = ReadData<
  typeof contracts.AccountResource,
  ReturnType<typeof queries.accountQuery>
>["rows"][number];

const accountColumn = columnsFor<
  typeof contracts.AccountResource,
  AccountRow
>();

const accountColumns = [
  accountColumn.sortable("id", (direction) => ({ id: direction })),
  accountColumn.sortable("name", (direction) => ({ name: direction })),
  accountColumn.sortable("tier", (direction) => ({ tier: direction })),
  accountColumn.sortable("region", (direction) => ({ region: direction })),
  accountColumn.sortable("creditLimitCents", (direction) => ({
    creditLimitCents: direction,
  })),
  accountColumn.sortable("grossRevenueCents", (direction) => ({
    grossRevenueCents: direction,
  })),
  accountColumn.sortable("netRevenueCents", (direction) => ({
    netRevenueCents: direction,
  })),
  accountColumn.sortable("costCents", (direction) => ({
    costCents: direction,
  })),
  accountColumn.sortable("revenueOrderCount", (direction) => ({
    revenueOrderCount: direction,
  })),
  accountColumn.sortable("marginBps", (direction) => ({
    marginBps: direction,
  })),
  accountColumn.sortable("openTicketCount", (direction) => ({
    openTicketCount: direction,
  })),
  accountColumn.sortable("lateShipmentCount", (direction) => ({
    lateShipmentCount: direction,
  })),
  accountColumn.sortable("riskScore", (direction) => ({
    riskScore: direction,
  })),
  accountColumn.sortable("riskBand", (direction) => ({ riskBand: direction })),
  accountColumn.sortable("managerRevenueCents", (direction) => ({
    managerRevenueCents: direction,
  })),
  accountColumn.sortable("managerConcentrationBps", (direction) => ({
    managerConcentrationBps: direction,
  })),
  accountColumn.sortable("portfolioShareBps", (direction) => ({
    portfolioShareBps: direction,
  })),
  accountColumn.sortable("recentOrderCount", (direction) => ({
    recentOrderCount: direction,
  })),
  accountColumn.sortable("recentOrderAverage", (direction) => ({
    recentOrderAverage: direction,
  })),
  accountColumn.sortable("recentOrderMin", (direction) => ({
    recentOrderMin: direction,
  })),
  accountColumn.sortable("recentOrderMax", (direction) => ({
    recentOrderMax: direction,
  })),
  accountColumn.sortable("latestPaidOrderCents", (direction) => ({
    latestPaidOrderCents: direction,
  })),
  accountColumn.sortable("orderVolatility", (direction) => ({
    orderVolatility: direction,
  })),
];

export function bindAccount(
  values: queries.AccountInputs,
  update: (values: queries.AccountInputs) => void,
) {
  const bound = bindCollection(
    accountColumns,
    dashboardFilters.AccountResourceFilterEditors,
    values,
    update,
    [
      includeControl({
        key: "manager",
        many: false,
        selected: values.includeManager,
        toggle: () =>
          update({
            ...values,
            includeManager: !values.includeManager,
            offset: 0,
          }),
        child: values.includeManager
          ? bindAgent(values.manager, (next) =>
              update({ ...values, manager: next, offset: 0 }),
            )
          : undefined,
      }),
      includeControl({
        key: "orders",
        many: true,
        selected: values.includeOrders,
        toggle: () =>
          update({
            ...values,
            includeOrders: !values.includeOrders,
            offset: 0,
          }),
        child: values.includeOrders
          ? bindOrder(values.orders, (next) =>
              update({ ...values, orders: next, offset: 0 }),
            )
          : undefined,
      }),
      includeControl({
        key: "tickets",
        many: true,
        selected: values.includeTickets,
        toggle: () =>
          update({
            ...values,
            includeTickets: !values.includeTickets,
            offset: 0,
          }),
        child: values.includeTickets
          ? bindTicket(values.tickets, (next) =>
              update({ ...values, tickets: next, offset: 0 }),
            )
          : undefined,
      }),
    ],
  );
  return appendColumns(
    bound,
    when(values.includeManager, () => accountColumn.relation("manager")),
    when(values.includeOrders, () => accountColumn.relation("orders")),
    when(values.includeTickets, () => accountColumn.relation("tickets")),
  );
}
