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
import { Lines, type Id } from "../database/models";

export const costOutput = schema.object({ costCents: schema.number() });

export const Cost = defineResource({ costCents: field.number() });

export async function loadCost({ parents, context }: Input) {
  count(context, "costBatch");
  count(context, "costParents", parents.length);
  const ids = idsFor(parents);
  const totals = await Lines.aggregate<{
    _id: Id;
    costCents: number;
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
    { $group: { _id: `$${parentKey}`, costCents: { $sum: "$costCents" } } },
  ]);
  const byId = new Map(totals.map((row) => [String(row._id), row.costCents]));
  return parents.map(({ ref, row }) => ({
    ref,
    rows: [{ costCents: byId.get(String(row._id)) ?? 0 }],
  }));
}
