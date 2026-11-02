import type { ReadData } from "@n/adira.core.ts";
import type { AccountResource } from "../../contracts/resources";
import { count, type RequestContext } from "../../harness/telemetry";
import type { portfolioConcentration } from "../../harness/workloads/advanced";
import { AS_OF, DAY } from "../clock";
import {
  Accounts,
  Agents,
  Orders,
  Tickets,
  type Account,
  type Agent,
  type Id,
  type Ticket,
} from "../database/models";
import { base, byObjectId as byId, key, unique } from "../database/records";
import { paidWindow } from "../orders/rules";
import { shareBps } from "./rules";
import { eligibleAccounts } from "./selection.reference";

type Portfolio = {
  _id: Id;
  total: number;
  largest: number;
  accounts: {
    id: Id;
    net: number;
  }[];
};

export async function portfolios(
  managerIds: Id[],
  c: RequestContext,
): Promise<Portfolio[]> {
  if (!managerIds.length) return [];
  return Orders.collection
    .aggregate<Portfolio>([
      {
        $match: {
          ...base(c),
          ...paidWindow,
          managerId: { $in: unique(managerIds) },
        },
      },
      {
        $group: {
          _id: { manager: "$managerId", account: "$accountId" },
          net: { $sum: { $subtract: ["$totalCents", "$refundedCents"] } },
        },
      },
      {
        $group: {
          _id: "$_id.manager",
          total: { $sum: "$net" },
          largest: { $max: "$net" },
          accounts: { $push: { id: "$_id.account", net: "$net" } },
        },
      },
    ])
    .toArray();
}

export async function referencePortfolio(
  c: RequestContext,
): Promise<ReadData<typeof AccountResource, typeof portfolioConcentration>> {
  const accounts = await Accounts.collection
    .find<Account>(eligibleAccounts(c))
    .toArray();
  const ids = accounts.map((a) => a._id),
    managers = unique(accounts.map((a) => a.managerId));
  if (!ids.length) return { rows: [] };
  count(c, "uniqueManagers", managers.length);
  count(c, "managerPortfolioParents", accounts.length);
  const [portfolio, tickets] = await Promise.all([
    portfolios(managers, c),
    Tickets.collection
      .find<Ticket>({
        ...base(c),
        accountId: { $in: ids },
        status: { $in: ["open", "pending"] },
        priority: { $gte: 4 },
        openedAt: { $gte: AS_OF - 30 * DAY },
      })
      .sort({ priority: -1, _id: 1 })
      .toArray(),
  ]);
  const pMap = new Map(portfolio.map((p) => [key(p._id), p]));
  const revenues = new Map(
    portfolio.flatMap((p) =>
      p.accounts.map((a) => [key(a.id), a.net] as const),
    ),
  );
  const escalations = new Set(tickets.map((t) => key(t.accountId)));
  const chosen = accounts
    .map((a) => {
      const p = pMap.get(key(a.managerId)),
        total = p?.total ?? 0,
        revenue = revenues.get(key(a._id)) ?? 0;
      return {
        account: a,
        netRevenueCents: revenue,
        managerRevenueCents: total,
        managerConcentrationBps: shareBps(p?.largest ?? 0, total),
        portfolioShareBps: shareBps(revenue, total),
      };
    })
    .filter(
      (r) =>
        (r.portfolioShareBps >= 200 && r.managerRevenueCents >= 500000) ||
        (escalations.has(key(r.account._id)) &&
          !(r.managerConcentrationBps < 2000)),
    )
    .sort(
      (a, b) =>
        b.portfolioShareBps - a.portfolioShareBps ||
        b.netRevenueCents - a.netRevenueCents ||
        byId(a.account, b.account),
    )
    .slice(0, 20);
  const agents = chosen.length
    ? await Agents.collection
        .find<Agent>({
          ...base(c),
          _id: { $in: unique(chosen.map((a) => a.account.managerId)) },
        })
        .toArray()
    : [];
  const agentMap = new Map(agents.map((a) => [key(a._id), a]));
  return {
    rows: chosen.map(({ account, ...metrics }) => ({
      id: key(account._id),
      name: account.name,
      ...metrics,
      manager: agentMap.has(key(account.managerId))
        ? { name: agentMap.get(key(account.managerId))!.name }
        : null,
      tickets: tickets
        .filter((t) => key(t.accountId) === key(account._id))
        .slice(0, 2)
        .map((t) => ({ subject: t.subject, priority: t.priority })),
    })),
  };
}
