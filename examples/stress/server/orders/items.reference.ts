import { count, type RequestContext } from "../../harness/telemetry";
import {
  Inventories,
  Lines,
  Products,
  type Id,
  type Inventory,
  type Line,
  type Product,
} from "../database/models";
import { base, byObjectId as byId, key, unique } from "../database/records";
import { stockStatus } from "../products/rules";

type StockRow = Pick<
  Inventory,
  "_id" | "productId" | "warehouse" | "onHand" | "reserved"
>;

type LineInputs = Pick<
  Line,
  "_id" | "orderId" | "productId" | "quantity" | "grossCents" | "costCents"
>;

type StockCache = {
  totals: Map<string, number>;
  rows: Map<string, StockRow[]>;
};

type EnrichedLine = LineInputs & {
  marginCents: number;
  shortageUnits: number;
};

export async function linesWithStock(
  orderIds: Id[],
  c: RequestContext,
): Promise<{
  lines: EnrichedLine[];
  stock: StockCache;
}> {
  if (!orderIds.length)
    return { lines: [], stock: { totals: new Map(), rows: new Map() } };
  const lines = await Lines.collection
    .find<LineInputs>(
      { ...base(c), orderId: { $in: unique(orderIds) } },
      {
        projection: {
          _id: 1,
          orderId: 1,
          productId: 1,
          quantity: 1,
          grossCents: 1,
          costCents: 1,
        },
      },
    )
    .batchSize(10000)
    .toArray();
  const products = unique(lines.map((l) => l.productId));
  const inventory = products.length
    ? await Inventories.collection
        .find<StockRow>(
          { ...base(c), productId: { $in: products } },
          {
            projection: {
              _id: 1,
              productId: 1,
              warehouse: 1,
              onHand: 1,
              reserved: 1,
            },
          },
        )
        .batchSize(10000)
        .toArray()
    : [];
  const totals = new Map<string, number>(),
    rows = new Map<string, StockRow[]>();
  for (const row of inventory) {
    const id = key(row.productId);
    totals.set(id, (totals.get(id) ?? 0) + row.onHand - row.reserved);
    const list = rows.get(id) ?? [];
    list.push(row);
    rows.set(id, list);
  }
  count(c, "distinctStockProducts", products.length);
  return {
    lines: lines.map((line) => ({
      ...line,
      marginCents: line.grossCents - line.costCents,
      shortageUnits: Math.max(
        0,
        line.quantity - Math.max(0, totals.get(key(line.productId)) ?? 0),
      ),
    })),
    stock: { totals, rows },
  };
}

type Item = {
  quantity: number;
  marginCents: number;
  shortageUnits: number;
  product: {
    sku: string;
    inventory: {
      warehouse: string;
      available: number;
      stockStatus: string;
    }[];
  } | null;
};

export async function nestedItems(
  data: Awaited<ReturnType<typeof linesWithStock>>,
  c: RequestContext,
  variant: "fulfillment" | "triage",
): Promise<Map<string, Item[]>> {
  const grouped = new Map<string, EnrichedLine[]>();
  for (const line of data.lines) {
    const pass =
      variant === "fulfillment"
        ? (line.shortageUnits >= 1 && line.marginCents >= 10000) ||
          (!(line.marginCents >= 20000) && line.quantity >= 3)
        : line.marginCents >= 5000 &&
          (line.quantity >= 3 || line.shortageUnits >= 1);
    if (!pass) continue;
    const id = key(line.orderId),
      list = grouped.get(id) ?? [];
    list.push(line);
    grouped.set(id, list);
  }
  for (const [id, list] of grouped)
    grouped.set(
      id,
      list
        .sort(
          (a, b) =>
            (variant === "fulfillment"
              ? b.shortageUnits - a.shortageUnits
              : 0) ||
            b.marginCents - a.marginCents ||
            byId(a, b),
        )
        .slice(0, 2),
    );
  const ids = unique([...grouped.values()].flat().map((l) => l.productId));
  const products = ids.length
    ? await Products.collection
        .find<Product>(
          { ...base(c), _id: { $in: ids } },
          { projection: { _id: 1, sku: 1 } },
        )
        .toArray()
    : [];
  const productMap = new Map(products.map((p) => [key(p._id), p]));
  return new Map(
    [...grouped].map(([id, lines]) => [
      id,
      lines.map((line) => {
        const product = productMap.get(key(line.productId));
        return {
          quantity: line.quantity,
          marginCents: line.marginCents,
          shortageUnits: line.shortageUnits,
          product: product
            ? {
                sku: product.sku,
                inventory: (data.stock.rows.get(key(product._id)) ?? [])
                  .filter((r) => r.onHand - r.reserved < 30)
                  .sort(
                    (a, b) =>
                      a.onHand - a.reserved - (b.onHand - b.reserved) ||
                      byId(a, b),
                  )
                  .slice(0, 1)
                  .map((row) => {
                    count(c, "stockStatus");
                    return {
                      warehouse: row.warehouse,
                      available: row.onHand - row.reserved,
                      stockStatus: stockStatus(row.onHand - row.reserved),
                    };
                  }),
              }
            : null,
        };
      }),
    ]),
  );
}
