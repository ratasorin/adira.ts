import { count, type RequestContext } from "../../harness/telemetry";
import {
  Accounts,
  Orders,
  Shipments,
  Tickets,
  type Account,
  type Id,
} from "../database/models";
import { base, byId, key, selected } from "../database/records";
import { financials } from "./finance.reference";
import { riskBand, riskScore } from "./rules";

async function counts(c: RequestContext, ids: Id[]) {
  if (!ids.length)
    return {
      tickets: new Map<string, number>(),
      late: new Map<string, number>(),
      exposure: new Map<string, number>(),
    };
  const match = { ...base(c), accountId: { $in: ids } };
  const [tickets, late, exposure] = await Promise.all([
    Tickets.collection
      .aggregate<{
        _id: Id;
        count: number;
      }>([
        { $match: { ...match, status: { $in: ["open", "pending"] } } },
        { $group: { _id: "$accountId", count: { $sum: 1 } } },
      ])
      .toArray(),
    Shipments.collection
      .aggregate<{
        _id: Id;
        count: number;
      }>([
        { $match: { ...match, late: true } },
        { $group: { _id: "$accountId", count: { $sum: 1 } } },
      ])
      .toArray(),
    Orders.collection
      .aggregate<{
        _id: Id;
        count: number;
      }>([
        { $match: { ...match, status: { $in: ["pending", "paid"] } } },
        {
          $group: {
            _id: "$accountId",
            count: { $sum: { $subtract: ["$totalCents", "$refundedCents"] } },
          },
        },
      ])
      .toArray(),
  ]);
  return {
    tickets: new Map(tickets.map((r) => [key(r._id), r.count])),
    late: new Map(late.map((r) => [key(r._id), r.count])),
    exposure: new Map(exposure.map((r) => [key(r._id), r.count])),
  };
}

export async function accountMetrics(
  accounts: Account[],
  c: RequestContext,
  risk: boolean,
) {
  const [finance, service] = await Promise.all([
    financials(accounts, c, !risk),
    risk
      ? counts(
          c,
          accounts.map((a) => a._id),
        )
      : Promise.resolve(null),
  ]);
  return accounts.map((account) => {
    const id = key(account._id),
      fin = finance.get(id)!;
    const row = {
      ...account,
      id,
      ...fin,
      openTicketCount: service?.tickets.get(id) ?? 0,
      lateShipmentCount: service?.late.get(id) ?? 0,
      exposureCents: service?.exposure.get(id) ?? 0,
    };
    if (risk) count(c, "riskScore");
    const score = risk ? riskScore(row) : 0;
    return { ...row, riskScore: score, riskBand: riskBand(score) };
  });
}

export async function referenceRisk(c: RequestContext) {
  const filter = {
    ...base(c),
    region: { $in: ["EU", "NA"] },
    tier: { $ne: "starter" },
  };
  const accounts = await Accounts.collection
    .find<Account>(filter)
    .sort({ name: 1, _id: 1 })
    .toArray();
  const rows = await accountMetrics(accounts, c, true);
  return {
    rows: rows
      .filter((r) => r.riskScore >= 45 || r.openTicketCount >= 4)
      .sort((a, b) => b.riskScore - a.riskScore || byId(a, b))
      .slice(0, 25)
      .map((r) =>
        selected(r, [
          "id",
          "name",
          "region",
          "netRevenueCents",
          "openTicketCount",
          "lateShipmentCount",
          "riskScore",
          "riskBand",
        ]),
      ),
  };
}
