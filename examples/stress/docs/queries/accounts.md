# Accounts: Adira and MongoDB

[All comparisons](../query-comparisons.md) · [Executable source](../../queries/accounts.ts)

Both sides use the same tenant and soft-delete scope. Imports and domain helpers come from the linked source.

## Account directory

Returns a stable page of European accounts.

Adira:

```ts
const directoryQuery = normalizeReadQuery(AccountResource, {
  select: { id: true, name: true, region: true },
  where: { region: { $eq: "EU" } },
  orderBy: { name: "asc", id: "asc" },
  page: { limit: 10 },
});
export const directoryAdira = async (context: RequestContext) =>
  (await readAccounts(directoryQuery, context)).rows;
```

MongoDB:

```ts
export const directoryMongo = async (context: RequestContext) => {
  const rows = await Accounts.collection
    .find<Account>(
      { ...scope(context), region: "EU" },
      { projection: { name: 1, region: 1 } },
    )
    .sort({ name: 1, _id: 1 })
    .limit(10)
    .toArray();
  return rows.map((row) => ({
    id: key(row._id),
    name: row.name,
    region: row.region,
  }));
};
```

## Credit limits

Filters and sorts a numeric field without selecting the sort tie-breaker.

Adira:

```ts
const creditQuery = normalizeReadQuery(AccountResource, {
  select: { name: true, creditLimitCents: true },
  where: { creditLimitCents: { $gte: 500_000 } },
  orderBy: { creditLimitCents: "desc", id: "asc" },
  page: { limit: 10 },
});
export const creditLimitsAdira = async (context: RequestContext) =>
  (await readAccounts(creditQuery, context)).rows;
```

MongoDB:

```ts
export const creditLimitsMongo = async (context: RequestContext) => {
  const rows = await Accounts.collection
    .find<Account>(
      { ...scope(context), creditLimitCents: { $gte: 500_000 } },
      { projection: { name: 1, creditLimitCents: 1 } },
    )
    .sort({ creditLimitCents: -1, _id: 1 })
    .limit(10)
    .toArray();
  return rows.map(({ name, creditLimitCents }) => ({ name, creditLimitCents }));
};
```

## Account managers

A missing or soft-deleted manager returns `null`.

Adira:

```ts
const managerQuery = normalizeReadQuery(AccountResource, {
  select: { name: true, manager: { select: { name: true, region: true } } },
  orderBy: { id: "asc" },
  page: { limit: 5 },
});
export const managersAdira = async (context: RequestContext) =>
  (await readAccounts(managerQuery, context)).rows;
```

MongoDB:

```ts
export const managersMongo = async (context: RequestContext) => {
  const accounts = await Accounts.collection
    .find<Account>(scope(context))
    .sort({ _id: 1 })
    .limit(5)
    .toArray();
  const agents = await Agents.collection
    .find<Agent>({
      ...scope(context),
      _id: { $in: accounts.map((row) => row.managerId) },
    })
    .toArray();
  const byId = new Map(agents.map((row) => [key(row._id), row]));
  return accounts.map((row) => {
    const agent = byId.get(key(row.managerId));
    return {
      name: row.name,
      manager: agent ? { name: agent.name, region: agent.region } : null,
    };
  });
};
```

## Account revenue

Computes complete ninety-day net revenue before filtering and paging.

Adira:

```ts
const revenueQuery = normalizeReadQuery(AccountResource, {
  select: { name: true, netRevenueCents: true },
  where: { region: { $in: ["EU", "NA"] }, netRevenueCents: { $gte: 10_000 } },
  orderBy: { netRevenueCents: "desc", id: "asc" },
  page: { limit: 10 },
});
export const revenueAdira = async (context: RequestContext) =>
  (await readAccounts(revenueQuery, context)).rows;
```

MongoDB:

```ts
export const revenueMongo = async (context: RequestContext) => {
  const accounts = await Accounts.collection
    .find<Account>({ ...scope(context), region: { $in: ["EU", "NA"] } })
    .toArray();
  const totals = await Orders.collection
    .aggregate<{
      _id: Id;
      net: number;
    }>([
      {
        $match: {
          ...scope(context),
          accountId: { $in: accounts.map((row) => row._id) },
          placedAt: { $gte: SINCE },
          status: { $in: ["paid", "shipped"] },
        },
      },
      {
        $group: {
          _id: "$accountId",
          net: { $sum: { $subtract: ["$totalCents", "$refundedCents"] } },
        },
      },
    ])
    .toArray();
  const byAccount = new Map(totals.map((row) => [key(row._id), row.net]));
  return accounts
    .map((row) => ({
      id: key(row._id),
      name: row.name,
      netRevenueCents: byAccount.get(key(row._id)) ?? 0,
    }))
    .filter((row) => row.netRevenueCents >= 10_000)
    .sort(
      (a, b) =>
        b.netRevenueCents - a.netRevenueCents || a.id.localeCompare(b.id),
    )
    .slice(0, 10)
    .map(({ name, netRevenueCents }) => ({ name, netRevenueCents }));
};
```
