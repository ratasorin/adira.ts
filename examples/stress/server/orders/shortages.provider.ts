import { defineResource, field, schema } from "@n/adira.core.ts";
import { count } from "../../harness/telemetry";
import { activeTenant, idsFor, type Input } from "../database/batches";
import { Inventories, Lines, type Id, type Line } from "../database/models";

export const shortageOutput = schema.object({ shortageUnits: schema.number() });

export const ShortageSummary = defineResource({
  shortageUnits: field.number(),
});

export async function loadOrderShortages({ parents, context }: Input) {
  count(context, "shortageBatch");
  count(context, "shortageParents", parents.length);
  const lines = await Lines.collection
    .find<Pick<Line, "orderId" | "productId" | "quantity">>(
      { ...activeTenant(context), orderId: { $in: idsFor(parents) } },
      { projection: { _id: 0, orderId: 1, productId: 1, quantity: 1 } },
    )
    .batchSize(10000)
    .toArray();
  const productIds = [
    ...new Map(lines.map((l) => [String(l.productId), l.productId])).values(),
  ];
  const stock = productIds.length
    ? await Inventories.collection
        .aggregate<{
          _id: Id;
          available: number;
        }>([
          {
            $match: {
              ...activeTenant(context),
              productId: { $in: productIds },
            },
          },
          {
            $group: {
              _id: "$productId",
              available: { $sum: { $subtract: ["$onHand", "$reserved"] } },
            },
          },
        ])
        .toArray()
    : [];
  const finite = schema.number();
  const available = new Map(
    stock.map((row) => [String(row._id), finite.parse(row.available)]),
  );
  const totals = new Map<string, number>();
  for (const line of lines) {
    const shortage = Math.max(
      0,
      finite.parse(line.quantity) -
        Math.max(0, available.get(String(line.productId)) ?? 0),
    );
    const id = String(line.orderId);
    totals.set(id, (totals.get(id) ?? 0) + shortage);
  }
  count(context, "shortageLines", lines.length);
  count(context, "shortageDistinctProducts", productIds.length);
  return parents.map(({ ref, row }) => ({
    ref,
    rows: [{ shortageUnits: totals.get(String(row._id)) ?? 0 }],
  }));
}
