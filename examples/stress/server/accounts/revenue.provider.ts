import { defineResource, field, schema } from "@n/adira.core.ts";
import { count } from "../../harness/telemetry";
import { SINCE } from "../clock";
import {
  activeTenant,
  idsFor,
  parentGroups,
  parentKey,
  type Input,
} from "../database/batches";
import { Orders, type Id } from "../database/models";

export const revenueOutput = schema.object({
  grossRevenueCents: schema.number(),
  refundedCents: schema.number(),
  revenueOrderCount: schema.number(),
});

export const Revenue = defineResource({
  grossRevenueCents: field.number(),
  refundedCents: field.number(),
  revenueOrderCount: field.number(),
});

export async function loadRevenue({ parents, context }: Input) {
  count(context, "revenueBatch");
  count(context, "revenueParents", parents.length);
  const ids = idsFor(parents);
  const totals = await Orders.aggregate<{
    _id: Id;
    grossRevenueCents: number;
    refundedCents: number;
    revenueOrderCount: number;
  }>([
    {
      $match: {
        ...activeTenant(context),
        accountId: { $in: ids },
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
    },
    ...parentGroups("accountId", ids),
    {
      $group: {
        _id: `$${parentKey}`,
        grossRevenueCents: { $sum: "$totalCents" },
        refundedCents: { $sum: "$refundedCents" },
        revenueOrderCount: { $sum: 1 },
      },
    },
  ]);
  const byId = new Map(totals.map((row) => [String(row._id), row]));
  return parents.map(({ ref, row }) => {
    const value = byId.get(String(row._id));
    return {
      ref,
      rows: [
        {
          grossRevenueCents: value?.grossRevenueCents ?? 0,
          refundedCents: value?.refundedCents ?? 0,
          revenueOrderCount: value?.revenueOrderCount ?? 0,
        },
      ],
    };
  });
}
