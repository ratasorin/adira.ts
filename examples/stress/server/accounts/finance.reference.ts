import { type RequestContext } from "../../harness/telemetry";
import { SINCE } from "../clock";
import {
  Accounts,
  Lines,
  Orders,
  type Account,
  type Id,
} from "../database/models";
import { base, byId, key, selected } from "../database/records";
import { marginBps } from "./rules";

export type Finance = {
  grossRevenueCents: number;
  netRevenueCents: number;
  costCents: number;
  revenueOrderCount: number;
  marginBps: number;
};

export async function financials(
  accounts: readonly Account[],
  c: RequestContext,
  includeCost: boolean,
): Promise<Map<string, Finance>> {
  const ids = accounts.map((a) => a._id);
  if (!ids.length) return new Map();
  const filter = {
    ...base(c),
    accountId: { $in: ids },
    placedAt: { $gte: SINCE },
    status: { $in: ["paid", "shipped"] },
  };
  const [orders, costs] = await Promise.all([
    Orders.collection
      .aggregate<{
        _id: Id;
        gross: number;
        refunded: number;
        count: number;
      }>([
        { $match: filter },
        {
          $group: {
            _id: "$accountId",
            gross: { $sum: "$totalCents" },
            refunded: { $sum: "$refundedCents" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    includeCost
      ? Lines.collection
          .aggregate<{
            _id: Id;
            cost: number;
          }>([
            { $match: filter },
            { $group: { _id: "$accountId", cost: { $sum: "$costCents" } } },
          ])
          .toArray()
      : Promise.resolve([]),
  ]);
  const revenue = new Map(orders.map((o) => [key(o._id), o])),
    costMap = new Map(costs.map((o) => [key(o._id), o.cost]));
  return new Map(
    accounts.map((a) => {
      const value = revenue.get(key(a._id)),
        net = (value?.gross ?? 0) - (value?.refunded ?? 0),
        cost = costMap.get(key(a._id)) ?? 0;
      return [
        key(a._id),
        {
          grossRevenueCents: value?.gross ?? 0,
          netRevenueCents: net,
          costCents: cost,
          revenueOrderCount: value?.count ?? 0,
          marginBps: marginBps(net, cost),
        },
      ];
    }),
  );
}

export async function referenceFinances(c: RequestContext) {
  const filter = {
    ...base(c),
    region: { $in: ["EU", "NA"] },
    tier: { $ne: "starter" },
  };
  const accounts = await Accounts.collection
    .find<Account>(filter)
    .sort({ name: 1, _id: 1 })
    .toArray();
  const finance = await financials(accounts, c, true);
  const rows = accounts.map((account) => ({
    ...account,
    id: key(account._id),
    ...finance.get(key(account._id))!,
  }));
  return {
    rows: rows
      .filter((r) => r.netRevenueCents >= 10000)
      .sort((a, b) => b.netRevenueCents - a.netRevenueCents || byId(a, b))
      .slice(0, 30)
      .map((r) =>
        selected(r, [
          "id",
          "name",
          "tier",
          "netRevenueCents",
          "revenueOrderCount",
          "marginBps",
        ]),
      ),
  };
}
