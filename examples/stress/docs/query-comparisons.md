# Twelve query comparisons

Each example has an Adira literal and an independent MongoDB implementation. [Integration tests](../tests/integration/comparisons.cases.ts) compare their ordered results in both smoke tenants. The server readers execute these examples; the frontend sends the same query shapes through its typed API without importing database code.

| #   | Level    | Example                                                      | Executable pair                              |
| --- | -------- | ------------------------------------------------------------ | -------------------------------------------- |
| 1   | Easy     | [Account directory](queries/accounts.md#account-directory)   | [account-directory](../queries/accounts.ts)  |
| 2   | Easy     | [Credit limits](queries/accounts.md#credit-limits)           | [credit-limits](../queries/accounts.ts)      |
| 3   | Easy     | [Order statuses](queries/orders.md#order-statuses)           | [order-statuses](../queries/orders.ts)       |
| 4   | Easy     | [Active products](queries/products.md#active-products)       | [active-products](../queries/products.ts)    |
| 5   | Moderate | [Account managers](queries/accounts.md#account-managers)     | [account-managers](../queries/accounts.ts)   |
| 6   | Moderate | [Order net](queries/orders.md#order-net)                     | [order-net](../queries/orders.ts)            |
| 7   | Moderate | [Order items](queries/orders.md#order-items)                 | [order-items](../queries/orders.ts)          |
| 8   | Moderate | [Product warehouses](queries/products.md#product-warehouses) | [product-warehouses](../queries/products.ts) |
| 9   | Complex  | [Account revenue](queries/accounts.md#account-revenue)       | [account-revenue](../queries/accounts.ts)    |
| 10  | Complex  | [Order priorities](queries/orders.md#order-priorities)       | [order-priorities](../queries/orders.ts)     |
| 11  | Complex  | [Available stock](queries/products.md#available-stock)       | [available-stock](../queries/products.ts)    |
| 12  | Complex  | [Stock cover](queries/products.md#stock-cover)               | [stock-cover](../queries/products.ts)        |

Adira checks selected fields, filter operands, relation shapes, ordering, and pages against the resource. The exact selection determines the returned row. Missing relations retain their declared nullability; conditional selections become optional properties.

For the manager example:

```ts
import type { InferRow } from "@n/adira.core.ts";
import { getAccounts } from "../frontend/lib/api";
import { managers } from "../queries/accounts";

const loadManagers = () => getAccounts(managers.query);
type ManagerRow = InferRow<typeof loadManagers>;
// { name: string; manager: { name: string; region: string } | null }
```

The MongoDB side explicitly projects, joins, computes, filters, and pages the same data. Its collection generics describe database rows; Adira additionally derives the selected response from the query and validates it at runtime. The full benchmark views are grouped under [accounts](../server/accounts/details.reference.ts), [orders](../server/orders/operations.reference.ts), and [products](../server/products/replenishment.reference.ts). Control-driven queries and compiler rejection examples are covered in [the query API guide](query-api.md).
