import { defineResource, field, schema } from "@n/adira.core.ts";
import { count } from "../../harness/telemetry";
import {
  activeTenant,
  idsFor,
  parentGroups,
  parentKey,
  type Input,
} from "../database/batches";
import { Inventories, type Id } from "../database/models";

export const stockOutput = schema.object({
  onHand: schema.number(),
  reserved: schema.number(),
  warehouseCount: schema.number(),
});

export const Stock = defineResource({
  onHand: field.number(),
  reserved: field.number(),
  warehouseCount: field.number(),
});

export async function loadStock({ parents, context }: Input) {
  count(context, "stockBatch");
  count(context, "stockParents", parents.length);
  const ids = idsFor(parents);
  const totals = await Inventories.aggregate<{
    _id: Id;
    onHand: number;
    reserved: number;
    warehouseCount: number;
  }>([
    { $match: { ...activeTenant(context), productId: { $in: ids } } },
    ...parentGroups("productId", ids),
    {
      $group: {
        _id: `$${parentKey}`,
        onHand: { $sum: "$onHand" },
        reserved: { $sum: "$reserved" },
        warehouseCount: { $sum: 1 },
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
          onHand: value?.onHand ?? 0,
          reserved: value?.reserved ?? 0,
          warehouseCount: value?.warehouseCount ?? 0,
        },
      ],
    };
  });
}
