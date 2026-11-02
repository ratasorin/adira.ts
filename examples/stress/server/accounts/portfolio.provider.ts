import { defineResource, field, schema } from "@n/adira.core.ts";
import { count } from "../../harness/telemetry";
import { SINCE } from "../clock";
import type { Input } from "../database/batches";
import { Orders, type Id } from "../database/models";

export const Portfolio = defineResource({
  revenueCents: field.number(),
  largestAccountCents: field.number(),
});

export const portfolioOutput = schema.object({
  revenueCents: schema.number(),
  largestAccountCents: schema.number(),
});

export async function loadPortfolio({
  parents,
  context,
}: Input<{ managerId: Id }>) {
  count(context, "managerPortfolioBatch");
  const ids = [
    ...new Map(
      parents.map((p) => [String(p.row.managerId), p.row.managerId]),
    ).values(),
  ];
  count(context, "uniqueManagers", ids.length);
  count(context, "managerPortfolioParents", parents.length);
  const totals = await Orders.aggregate<{
    _id: Id;
    total: number;
    largestAccountCents: number;
  }>([
    {
      $match: {
        tenantId: context.tenantId,
        deletedAt: null,
        managerId: { $in: ids },
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
    },
    {
      $group: {
        _id: { manager: "$managerId", account: "$accountId" },
        total: { $sum: { $subtract: ["$totalCents", "$refundedCents"] } },
      },
    },
    {
      $group: {
        _id: "$_id.manager",
        total: { $sum: "$total" },
        largestAccountCents: { $max: "$total" },
      },
    },
  ]);
  const map = new Map(totals.map((r) => [String(r._id), r]));
  return parents.map(({ ref, row }) => ({
    ref,
    rows: [
      {
        revenueCents: map.get(String(row.managerId))?.total ?? 0,
        largestAccountCents:
          map.get(String(row.managerId))?.largestAccountCents ?? 0,
      },
    ],
  }));
}
