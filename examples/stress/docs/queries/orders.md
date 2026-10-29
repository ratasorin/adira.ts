# Orders: Adira and MongoDB

[All comparisons](../query-comparisons.md) · [Executable source](../../queries/orders.ts)

Both sides use the same tenant and soft-delete scope. Imports and domain helpers come from the linked source.

## Order statuses

Composes two status conditions with OR.

Adira:

```ts
const statusQuery = normalizeReadQuery(OrderResource, {
  select: { number: true, status: true, totalCents: true },
  where: { $or: [{ status: { $eq: "pending" } }, { status: { $eq: "paid" } }] },
  orderBy: { id: "asc" },
  page: { limit: 10 },
});
export const statusesAdira = async (context: RequestContext) =>
  (await readOrders(statusQuery, context)).rows;
```

MongoDB:

```ts
export const statusesMongo = async (context: RequestContext) => {
  const rows = await Orders.collection
    .find<Order>({
      ...scope(context),
      $or: [{ status: "pending" }, { status: "paid" }],
    })
    .sort({ _id: 1 })
    .limit(10)
    .toArray();
  return rows.map(({ number, status, totalCents }) => ({
    number,
    status,
    totalCents,
  }));
};
```

## Order net

Derives net amount in MongoDB before filtering and sorting.

Adira:

```ts
const netQuery = normalizeReadQuery(OrderResource, {
  select: { number: true, netCents: true },
  where: { netCents: { $gte: 50_000 } },
  orderBy: { netCents: "desc", id: "asc" },
  page: { limit: 10 },
});
export const netAmountsAdira = async (context: RequestContext) =>
  (await readOrders(netQuery, context)).rows;
```

MongoDB:

```ts
export const netAmountsMongo = async (context: RequestContext) =>
  Orders.collection
    .aggregate<{
      number: string;
      netCents: number;
    }>([
      { $match: scope(context) },
      { $set: { netCents: { $subtract: ["$totalCents", "$refundedCents"] } } },
      { $match: { netCents: { $gte: 50_000 } } },
      { $sort: { netCents: -1, _id: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, number: 1, netCents: 1 } },
    ])
    .toArray();
```

## Order items

Returns three orders, each with its own two-item page and nullable product.

Adira:

```ts
const itemsQuery = normalizeReadQuery(OrderResource, {
  select: {
    number: true,
    items: {
      select: { quantity: true, product: { select: { sku: true } } },
      orderBy: { id: "asc" },
      page: { limit: 2 },
    },
  },
  orderBy: { id: "asc" },
  page: { limit: 3 },
});
export const itemsAdira = async (context: RequestContext) =>
  (await readOrders(itemsQuery, context)).rows;
```

MongoDB:

```ts
export const itemsMongo = async (context: RequestContext) => {
  const orders = await Orders.collection
    .find<Order>(scope(context))
    .sort({ _id: 1 })
    .limit(3)
    .toArray();
  const lines = await Lines.collection
    .find<Line>({
      ...scope(context),
      orderId: { $in: orders.map((row) => row._id) },
    })
    .sort({ _id: 1 })
    .toArray();
  const products = await Products.collection
    .find<Product>({
      ...scope(context),
      _id: { $in: lines.map((row) => row.productId) },
    })
    .toArray();
  const byId = new Map(products.map((row) => [key(row._id), row]));
  const byOrder = new Map<string, Line[]>();
  for (const line of lines) {
    const id = key(line.orderId);
    const group = byOrder.get(id) ?? [];
    group.push(line);
    byOrder.set(id, group);
  }
  return orders.map((row) => ({
    number: row.number,
    items: (byOrder.get(key(row._id)) ?? []).slice(0, 2).map((line) => {
      const product = byId.get(key(line.productId));
      return {
        quantity: line.quantity,
        product: product ? { sku: product.sku } : null,
      };
    }),
  }));
};
```

## Order priorities

Evaluates priority for all eligible candidates before choosing the top ten.

Adira:

```ts
const priorityQuery = normalizeReadQuery(OrderResource, {
  select: { number: true, priority: true },
  where: {
    region: { $eq: "EU" },
    placedAt: { $gte: AS_OF - 30 * DAY },
    priority: { $gte: 65 },
  },
  orderBy: { priority: "desc", id: "asc" },
  page: { limit: 10 },
});
export const prioritiesAdira = async (context: RequestContext) =>
  (await readOrders(priorityQuery, context)).rows;
```

MongoDB:

```ts
export const prioritiesMongo = async (context: RequestContext) => {
  const orders = await Orders.collection
    .find<Order>({
      ...scope(context),
      region: "EU",
      placedAt: { $gte: AS_OF - 30 * DAY },
    })
    .toArray();
  return orders
    .map((row) => ({
      id: key(row._id),
      number: row.number,
      priority: priority(
        row.totalCents,
        row.status,
        (AS_OF - row.placedAt) / DAY,
      ),
    }))
    .filter((row) => row.priority >= 65)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, 10)
    .map(({ number, priority }) => ({ number, priority }));
};
```
