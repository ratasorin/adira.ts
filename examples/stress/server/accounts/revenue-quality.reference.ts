import type { ReadData } from "@n/adira.core.ts";
import type { AccountResource } from "../../contracts/resources";
import { count, type RequestContext } from "../../harness/telemetry";
import type { revenueQuality } from "../../harness/workloads/advanced";
import {
  Accounts,
  Lines,
  Orders,
  type Account,
  type Id,
} from "../database/models";
import { base, byObjectId as byId, key } from "../database/records";
import {
  net,
  orderPriority,
  paidWindow,
  type FinancialOrder,
} from "../orders/rules";
import { marginBps } from "./rules";
import { eligibleAccounts } from "./selection.reference";

export async function referenceRevenueQuality(
  c: RequestContext,
): Promise<ReadData<typeof AccountResource, typeof revenueQuality>> {
  const accounts = await Accounts.collection
    .find<Account>(eligibleAccounts(c))
    .toArray();
  if (!accounts.length) return { rows: [] };
  const stats = await Orders.collection
    .aggregate<{
      _id: Id;
      count: number;
      avg: number;
      min: number;
      max: number;
      total: number;
      latest: number;
      topNet: FinancialOrder[];
    }>([
      {
        $match: {
          ...base(c),
          ...paidWindow,
          accountId: { $in: accounts.map((a) => a._id) },
        },
      },
      { $set: { netCents: { $subtract: ["$totalCents", "$refundedCents"] } } },
      {
        $group: {
          _id: "$accountId",
          count: { $sum: 1 },
          total: { $sum: "$netCents" },
          avg: { $avg: "$netCents" },
          min: { $min: "$netCents" },
          max: { $max: "$netCents" },
          latest: {
            $top: { sortBy: { placedAt: -1, _id: 1 }, output: "$netCents" },
          },
          topNet: {
            $topN: {
              n: 3,
              sortBy: { netCents: -1, _id: 1 },
              output: {
                _id: "$_id",
                totalCents: "$totalCents",
                refundedCents: "$refundedCents",
                status: "$status",
                placedAt: "$placedAt",
              },
            },
          },
        },
      },
    ])
    .toArray();
  const map = new Map(stats.map((s) => [key(s._id), s]));
  const chosen = accounts
    .flatMap((account) => {
      const s = map.get(key(account._id));
      if (
        !s ||
        !(
          (s.avg >= 200000 && s.max >= 400000) ||
          (s.count >= 3 && !(s.min >= 150000))
        )
      )
        return [];
      return [{ account, s }];
    })
    .sort((a, b) => b.s.avg - a.s.avg || byId(a.account, b.account))
    .slice(0, 20);
  if (!chosen.length) return { rows: [] };
  const costs = await Lines.collection
    .aggregate<{
      _id: Id;
      cost: number;
    }>([
      {
        $match: {
          ...base(c),
          ...paidWindow,
          accountId: { $in: chosen.map(({ account }) => account._id) },
        },
      },
      { $group: { _id: "$accountId", cost: { $sum: "$costCents" } } },
    ])
    .toArray();
  const costMap = new Map(costs.map((r) => [key(r._id), r.cost]));
  return {
    rows: chosen.map(({ account, s }) => ({
      id: key(account._id),
      name: account.name,
      recentOrderCount: s.count,
      recentOrderAverage: s.avg,
      recentOrderMin: s.min,
      recentOrderMax: s.max,
      latestPaidOrderCents: s.latest,
      marginBps: marginBps(s.total, costMap.get(key(account._id)) ?? 0),
      orders: s.topNet.slice(1, 3).map((order) => {
        count(c, "priority");
        return {
          id: key(order._id),
          netCents: net(order),
          priority: orderPriority(order),
        };
      }),
    })),
  };
}
