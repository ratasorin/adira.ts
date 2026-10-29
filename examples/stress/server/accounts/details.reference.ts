import { type RequestContext } from "../../harness/telemetry";
import { SINCE } from "../clock";
import {
  Accounts,
  Agents,
  Orders,
  Tickets,
  type Account,
  type Agent,
  type Id,
  type Order,
  type Ticket,
} from "../database/models";
import { base, key } from "../database/records";
import { nestedOrders } from "../orders/details.reference";
import { accountMetrics } from "./risk.reference";

export async function account360(c: RequestContext) {
  const accounts = await Accounts.collection
    .find<Account>({ ...base(c), region: "EU" })
    .sort({ name: 1, _id: 1 })
    .limit(12)
    .toArray();
  if (!accounts.length) return { rows: [] };
  const ids = accounts.map((a) => a._id),
    managers = [
      ...new Map(accounts.map((a) => [key(a.managerId), a.managerId])).values(),
    ];
  const [metrics, orders, tickets, agents, portfolio] = await Promise.all([
    accountMetrics(accounts, c, true),
    Orders.collection
      .aggregate<Order>([
        { $match: { ...base(c), accountId: { $in: ids } } },
        {
          $group: {
            _id: "$accountId",
            rows: {
              $topN: {
                n: 2,
                sortBy: { placedAt: -1, _id: 1 },
                output: "$$ROOT",
              },
            },
          },
        },
        { $unwind: "$rows" },
        { $replaceWith: "$rows" },
      ])
      .toArray(),
    Tickets.collection
      .find<Ticket>({
        ...base(c),
        accountId: { $in: ids },
        status: { $in: ["open", "pending"] },
      })
      .sort({ priority: -1, _id: 1 })
      .toArray(),
    Agents.collection
      .find<Agent>({ ...base(c), _id: { $in: managers } })
      .toArray(),
    Orders.collection
      .aggregate<{
        _id: Id;
        total: number;
      }>([
        {
          $match: {
            ...base(c),
            managerId: { $in: managers },
            placedAt: { $gte: SINCE },
            status: { $in: ["paid", "shipped"] },
          },
        },
        {
          $group: {
            _id: "$managerId",
            total: { $sum: { $subtract: ["$totalCents", "$refundedCents"] } },
          },
        },
      ])
      .toArray(),
  ]);
  const enriched = await nestedOrders(orders, c, false),
    orderMap = new Map(orders.map((o, i) => [key(o._id), enriched[i]]));
  const agentMap = new Map(agents.map((a) => [key(a._id), a.name])),
    portfolioMap = new Map(portfolio.map((r) => [key(r._id), r.total]));
  return {
    rows: metrics.map((row) => ({
      id: row.id,
      name: row.name,
      netRevenueCents: row.netRevenueCents,
      riskScore: row.riskScore,
      managerRevenueCents: portfolioMap.get(key(row.managerId)) ?? 0,
      manager: agentMap.has(key(row.managerId))
        ? { name: agentMap.get(key(row.managerId))! }
        : null,
      orders: orders
        .filter((o) => key(o.accountId) === row.id)
        .sort(
          (a, b) =>
            b.placedAt - a.placedAt || key(a._id).localeCompare(key(b._id)),
        )
        .map((o) => orderMap.get(key(o._id))!),
      tickets: tickets
        .filter((t) => key(t.accountId) === row.id)
        .slice(0, 2)
        .map((t) => ({ subject: t.subject, priority: t.priority })),
    })),
  };
}
