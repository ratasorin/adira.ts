import { defineResource, field, schema } from "@n/adira.core.ts";
import { count } from "../../harness/telemetry";
import type { Input } from "../database/batches";
import { Orders, type Id } from "../database/models";

export const Exposure = defineResource({ exposureCents: field.number() });

export const exposureOutput = schema.object({ exposureCents: schema.number() });

export async function loadExposure({ parents, context }: Input) {
  count(context, "exposureBatch");
  const totals = await Orders.aggregate<{
    _id: Id;
    total: number;
  }>([
    {
      $match: {
        tenantId: context.tenantId,
        deletedAt: null,
        accountId: { $in: parents.map((p) => p.row._id) },
        status: { $in: ["pending", "paid"] },
      },
    },
    {
      $group: {
        _id: "$accountId",
        total: { $sum: { $subtract: ["$totalCents", "$refundedCents"] } },
      },
    },
  ]);
  const map = new Map(totals.map((r) => [String(r._id), r.total]));
  return parents.map(({ ref, row }) => ({
    ref,
    rows: [{ exposureCents: map.get(String(row._id)) ?? 0 }],
  }));
}
