import * as contracts from "../../contracts/resources";
import { deriveQuery, when } from "../controls/query";
import { collectionInputs } from "../controls/table-controls";
import * as inputs from "../generated/controls";
import * as dashboardFilters from "../generated/dashboard-filters";
import { orderInputs, orderQuery } from "./orders";
import {
  agentInputs,
  agentQuery,
  ticketInputs,
  ticketQuery,
} from "./relations";

export function accountInputs(limit = 20) {
  return {
    ...collectionInputs<typeof contracts.AccountResource>(
      { ...inputs.AccountResourceColumns, id: true },
      limit,
    ),
    includeManager: false,
    manager: agentInputs(),
    includeOrders: false,
    orders: orderInputs(5),
    includeTickets: false,
    tickets: ticketInputs(5),
  };
}

export type AccountInputs = ReturnType<typeof accountInputs>;

export const accountQuery = deriveQuery(
  contracts.AccountResource,
  (values: AccountInputs) => {
    const where = dashboardFilters.AccountResourceFilterEditors.where(
      values.filters,
    );
    return {
      select: {
        id: when(values.columns.id, () => true),
        name: when(values.columns.name, () => true),
        tier: when(values.columns.tier, () => true),
        region: when(values.columns.region, () => true),
        creditLimitCents: when(values.columns.creditLimitCents, () => true),
        grossRevenueCents: when(values.columns.grossRevenueCents, () => true),
        netRevenueCents: when(values.columns.netRevenueCents, () => true),
        costCents: when(values.columns.costCents, () => true),
        revenueOrderCount: when(values.columns.revenueOrderCount, () => true),
        marginBps: when(values.columns.marginBps, () => true),
        openTicketCount: when(values.columns.openTicketCount, () => true),
        lateShipmentCount: when(values.columns.lateShipmentCount, () => true),
        riskScore: when(values.columns.riskScore, () => true),
        riskBand: when(values.columns.riskBand, () => true),
        managerRevenueCents: when(
          values.columns.managerRevenueCents,
          () => true,
        ),
        managerConcentrationBps: when(
          values.columns.managerConcentrationBps,
          () => true,
        ),
        portfolioShareBps: when(values.columns.portfolioShareBps, () => true),
        recentOrderCount: when(values.columns.recentOrderCount, () => true),
        recentOrderAverage: when(values.columns.recentOrderAverage, () => true),
        recentOrderMin: when(values.columns.recentOrderMin, () => true),
        recentOrderMax: when(values.columns.recentOrderMax, () => true),
        latestPaidOrderCents: when(
          values.columns.latestPaidOrderCents,
          () => true,
        ),
        orderVolatility: when(values.columns.orderVolatility, () => true),
        manager: when(values.includeManager, () => agentQuery(values.manager)),
        orders: when(values.includeOrders, () => orderQuery(values.orders)),
        tickets: when(values.includeTickets, () => ticketQuery(values.tickets)),
      },
      where,
      orderBy: values.orderBy,
      page: { limit: values.limit, offset: values.offset },
    };
  },
);
