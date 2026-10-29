import type { ReadData } from "@n/adira.core.ts";
import type { AccountResource } from "../../contracts/resources";
import { type RequestContext } from "../../harness/telemetry";
import type { nestedTriage } from "../../harness/workloads/advanced";
import { AS_OF, DAY } from "../clock";
import {
  Accounts,
  Agents,
  Orders,
  Tickets,
  type Account,
  type Agent,
  type Order,
  type Ticket,
} from "../database/models";
import { base, byObjectId as byId, key, unique } from "../database/records";
import { linesWithStock, nestedItems } from "../orders/items.reference";
import { portfolios } from "./portfolio.reference";
import { eligibleAccounts } from "./selection.reference";

export const nativePriority = {
  $min: [
    100,
    {
      $floor: {
        $add: [
          0.5,
          {
            $add: [
              {
                $multiply: [
                  {
                    $log: [
                      { $add: [1, { $divide: ["$totalCents", 1000] }] },
                      2,
                    ],
                  },
                  5,
                ],
              },
              { $cond: [{ $eq: ["$status", "pending"] }, 25, 0] },
              {
                $min: [
                  30,
                  {
                    $multiply: [
                      { $divide: [{ $subtract: [AS_OF, "$placedAt"] }, DAY] },
                      2,
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
};

export async function referenceNestedTriage(
  c: RequestContext,
): Promise<ReadData<typeof AccountResource, typeof nestedTriage>> {
  const accounts = await Accounts.collection
    .find<Account>(eligibleAccounts(c))
    .sort({ _id: 1 })
    .skip(1)
    .limit(12)
    .toArray();
  if (!accounts.length) return { rows: [] };
  const ids = accounts.map((a) => a._id),
    managers = unique(accounts.map((a) => a.managerId));
  const [orders, tickets, agents, portfolio] = await Promise.all([
    Orders.collection
      .aggregate<
        Order & {
          netCents: number;
          priority: number;
        }
      >([
        {
          $match: {
            ...base(c),
            accountId: { $in: ids },
            placedAt: { $gte: AS_OF - 30 * DAY },
            status: { $ne: "cancelled" },
          },
        },
        {
          $set: {
            netCents: { $subtract: ["$totalCents", "$refundedCents"] },
            priority: nativePriority,
          },
        },
        {
          $match: {
            netCents: { $gte: 20000 },
            $or: [{ priority: { $gte: 65 } }, { status: "pending" }],
          },
        },
        {
          $group: {
            _id: "$accountId",
            rows: {
              $topN: {
                n: 4,
                sortBy: { priority: -1, netCents: -1, _id: 1 },
                output: "$$ROOT",
              },
            },
          },
        },
        { $project: { rows: { $slice: ["$rows", 1, 3] } } },
        { $unwind: "$rows" },
        { $replaceWith: "$rows" },
      ])
      .toArray(),
    Tickets.collection
      .aggregate<Ticket>([
        {
          $match: {
            ...base(c),
            accountId: { $in: ids },
            status: { $in: ["open", "pending"] },
            priority: { $gte: 3 },
          },
        },
        {
          $group: {
            _id: "$accountId",
            rows: {
              $topN: {
                n: 3,
                sortBy: { priority: -1, openedAt: 1, _id: 1 },
                output: "$$ROOT",
              },
            },
          },
        },
        { $project: { rows: { $slice: ["$rows", 1, 2] } } },
        { $unwind: "$rows" },
        { $replaceWith: "$rows" },
      ])
      .toArray(),
    Agents.collection
      .find<Agent>({ ...base(c), _id: { $in: managers } })
      .toArray(),
    portfolios(managers, c),
  ]);
  const data = await linesWithStock(
    orders.map((o) => o._id),
    c,
  );
  const items = await nestedItems(data, c, "triage");
  const agentMap = new Map(agents.map((a) => [key(a._id), a]));
  const pMap = new Map(portfolio.map((p) => [key(p._id), p.total]));
  return {
    rows: accounts.map((account) => ({
      id: key(account._id),
      name: account.name,
      managerRevenueCents: pMap.get(key(account.managerId)) ?? 0,
      manager: agentMap.has(key(account.managerId))
        ? { name: agentMap.get(key(account.managerId))!.name }
        : null,
      orders: orders
        .filter((o) => key(o.accountId) === key(account._id))
        .sort(
          (a, b) =>
            b.priority - a.priority || b.netCents - a.netCents || byId(a, b),
        )
        .map((order) => ({
          id: key(order._id),
          status: order.status,
          netCents: order.netCents,
          priority: order.priority,
          items: items.get(key(order._id)) ?? [],
        })),
      tickets: tickets
        .filter((t) => key(t.accountId) === key(account._id))
        .sort(
          (a, b) =>
            b.priority - a.priority || a.openedAt - b.openedAt || byId(a, b),
        )
        .map((t) => ({ subject: t.subject, priority: t.priority })),
    })),
  };
}
