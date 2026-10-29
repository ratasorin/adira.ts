# Products: Adira and MongoDB

[All comparisons](../query-comparisons.md) · [Executable source](../../queries/products.ts)

Both sides use the same tenant and soft-delete scope. Imports and domain helpers come from the linked source.

## Active products

Filters the Boolean field while returning its declared type.

Adira:

```ts
const activeQuery = normalizeReadQuery(ProductResource, {
  select: { name: true, sku: true, active: true },
  where: { active: { $eq: true } },
  orderBy: { id: "asc" },
  page: { limit: 10 },
});
export const activeAdira = async (context: RequestContext) =>
  (await readProducts(activeQuery, context)).rows;
```

MongoDB:

```ts
export const activeMongo = async (context: RequestContext) => {
  const rows = await Products.collection
    .find<Product>({ ...scope(context), active: true })
    .sort({ _id: 1 })
    .limit(10)
    .toArray();
  return rows.map(({ name, sku, active }) => ({ name, sku, active }));
};
```

## Product warehouses

Pages warehouse stock independently for each selected product.

Adira:

```ts
const inventoryQuery = normalizeReadQuery(ProductResource, {
  select: {
    sku: true,
    inventory: {
      select: { warehouse: true, available: true, stockStatus: true },
      orderBy: { warehouse: "asc", id: "asc" },
      page: { limit: 2 },
    },
  },
  where: { active: { $eq: true } },
  orderBy: { id: "asc" },
  page: { limit: 5 },
});
export const warehousesAdira = async (context: RequestContext) =>
  (await readProducts(inventoryQuery, context)).rows;
```

MongoDB:

```ts
export const warehousesMongo = async (context: RequestContext) => {
  const products = await Products.collection
    .find<Product>({ ...scope(context), active: true })
    .sort({ _id: 1 })
    .limit(5)
    .toArray();
  const stock = await Inventories.collection
    .find<Inventory>({
      ...scope(context),
      productId: { $in: products.map((row) => row._id) },
    })
    .sort({ warehouse: 1, _id: 1 })
    .toArray();
  const byProduct = new Map<string, Inventory[]>();
  for (const row of stock) {
    const id = key(row.productId),
      group = byProduct.get(id) ?? [];
    group.push(row);
    byProduct.set(id, group);
  }
  return products.map((row) => ({
    sku: row.sku,
    inventory: (byProduct.get(key(row._id)) ?? []).slice(0, 2).map((stock) => {
      const available = stock.onHand - stock.reserved;
      return {
        warehouse: stock.warehouse,
        available,
        stockStatus: stockStatus(available),
      };
    }),
  }));
};
```

## Shared product measures

The next two native queries use this stock/sales join.

```ts
async function productMeasures(context: RequestContext, includeSales: boolean) {
  const products = await Products.collection
    .find<Product>({ ...scope(context), active: true })
    .toArray();
  const ids = products.map((row) => row._id);
  const [stock, sales] = await Promise.all([
    Inventories.collection
      .aggregate<{
        _id: Id;
        available: number;
        warehouses: number;
      }>([
        { $match: { ...scope(context), productId: { $in: ids } } },
        {
          $group: {
            _id: "$productId",
            available: { $sum: { $subtract: ["$onHand", "$reserved"] } },
            warehouses: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    includeSales
      ? Lines.collection
          .aggregate<{
            _id: Id;
            quantity: number;
          }>([
            {
              $match: {
                ...scope(context),
                productId: { $in: ids },
                placedAt: { $gte: SINCE },
                status: { $in: ["paid", "shipped"] },
              },
            },
            { $group: { _id: "$productId", quantity: { $sum: "$quantity" } } },
          ])
          .toArray()
      : Promise.resolve([]),
  ]);
  const byProduct = new Map(stock.map((row) => [key(row._id), row]));
  const sold = new Map(sales.map((row) => [key(row._id), row.quantity]));
  return products.map((row) => {
    const id = key(row._id),
      available = byProduct.get(id)?.available ?? 0,
      unitsSold = sold.get(id) ?? 0;
    return {
      id,
      sku: row.sku,
      available,
      warehouseCount: byProduct.get(id)?.warehouses ?? 0,
      unitsSold,
      daysCover: daysCover(available, unitsSold),
    };
  });
}
```

## Available stock

Groups all eligible warehouses for each candidate product.

Adira:

```ts
const availableQuery = normalizeReadQuery(ProductResource, {
  select: { sku: true, available: true, warehouseCount: true },
  where: { active: { $eq: true } },
  orderBy: { available: "asc", id: "asc" },
  page: { limit: 10 },
});
export const availableStockAdira = async (context: RequestContext) =>
  (await readProducts(availableQuery, context)).rows;
```

MongoDB:

```ts
export const availableStockMongo = async (context: RequestContext) =>
  (await productMeasures(context, false))
    .sort((a, b) => a.available - b.available || a.id.localeCompare(b.id))
    .slice(0, 10)
    .map(({ sku, available, warehouseCount }) => ({
      sku,
      available,
      warehouseCount,
    }));
```

## Stock cover

Combines complete stock and ninety-day sales before filtering days of cover.

Adira:

```ts
const coverQuery = normalizeReadQuery(ProductResource, {
  select: { sku: true, unitsSold: true, daysCover: true },
  where: { active: { $eq: true }, daysCover: { $lt: 30 } },
  orderBy: { daysCover: "asc", id: "asc" },
  page: { limit: 10 },
});
export const replenishmentAdira = async (context: RequestContext) =>
  (await readProducts(coverQuery, context)).rows;
```

MongoDB:

```ts
export const replenishmentMongo = async (context: RequestContext) =>
  (await productMeasures(context, true))
    .filter((row) => row.daysCover < 30)
    .sort((a, b) => a.daysCover - b.daysCover || a.id.localeCompare(b.id))
    .slice(0, 10)
    .map(({ sku, unitsSold, daysCover }) => ({ sku, unitsSold, daysCover }));
```
