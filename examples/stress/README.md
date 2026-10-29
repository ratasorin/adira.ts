# Commerce query stress test

A commerce application for exercising Adira's typed queries, demand-driven execution, tenant policies, and nested pagination against independent MongoDB implementations. The dashboard lets you change the actual request through columns, filters, relation includes, sorting, and paging. Benchmarks compare complete ordered results before measuring latency.

## Run

From the repository root, with Node 20.19+ or 22.12+ and `mongod` on PATH:

```sh
npm install
npm run stress:build
npm run stress:demo -- --profile smoke
```

Open **http://127.0.0.1:5400**. Use `--profile medium` for the recorded benchmark dataset: 756,804 documents across four tenants. The demo starts a private MongoDB instance; Ctrl-C removes its temporary data.

## Where to start

The server is grouped by business area. Each feature's `.adira.ts` and `.reference.ts` files sit together.

```text
server/
  accounts/
    details.adira.ts          details.reference.ts
    finance.adira.ts          finance.reference.ts
    risk.adira.ts             risk.reference.ts
    revenue-quality.adira.ts  revenue-quality.reference.ts
    portfolio.adira.ts        portfolio.reference.ts
    history.adira.ts          history.reference.ts
  orders/
    details.adira.ts          details.reference.ts
    operations.adira.ts       operations.reference.ts
    fulfillment.adira.ts      fulfillment.reference.ts
    items.adira.ts            items.reference.ts
  products/
    replenishment.adira.ts    replenishment.reference.ts
    inventory.adira.ts        inventory.reference.ts
```

| Read                                                                                                                                 | Purpose                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| [contracts/resources.ts](contracts/resources.ts)                                                                                     | Public fields, relations, operators, and limits. Safe to import in the browser.                     |
| [Accounts](server/accounts/details.adira.ts), [orders](server/orders/details.adira.ts), [products](server/products/details.adira.ts) | Resource composition. Each folder also contains its rules and MongoDB providers.                    |
| [frontend/queries](frontend/queries/index.ts)                                                                                        | Explicit literal queries assembled from dashboard controls.                                         |
| [frontend/screens](frontend/screens/index.ts)                                                                                        | Resource-specific column, filter, include, and update bindings.                                     |
| [frontend/features/explorer](frontend/features/explorer/dashboard.tsx)                                                               | Fetching and the shadcn/ui dashboard.                                                               |
| [queries](queries/index.ts)                                                                                                          | Twelve smaller Adira/MongoDB query pairs.                                                           |
| [harness](harness/demo.ts)                                                                                                           | Synthetic data, HTTP transport, dispatch, diagnostics, and benchmark runners.                       |
| [tests](tests/integration/index.ts)                                                                                                  | Integration cases; adjacent `controls`, `types`, and `browser` directories cover frontend behavior. |

Follow `riskScore`: [contract](contracts/resources.ts) → [Adira dependencies](server/accounts/risk.adira.ts) / [native reference](server/accounts/risk.reference.ts) → [account rules](server/accounts/rules.ts) → [frontend query](frontend/queries/accounts.ts).

## Business questions

| View             | What it obtains                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| Directory        | A filtered, sorted page of accounts without financial or service computations.                      |
| Revenue & margin | Ninety-day paid/shipped revenue, refunds, costs, and margin.                                        |
| Service risk     | Accounts needing attention based on credit exposure, tickets, late shipments, and revenue.          |
| Account 360°     | Account details with a manager, orders, items, products, warehouse stock, and tickets.              |
| Order operations | Recent orders ranked by amount, age, and pending status.                                            |
| Replenishment    | Active products with low days of cover from available inventory and ninety-day sales.               |
| Revenue quality  | Complete order count, average, minimum, maximum, and latest amount alongside a small order preview. |
| Fulfillment      | Orders ranked by priority and shortages, with the affected items and stock.                         |
| Nested triage    | Independently filtered, sorted, and paged orders/items/warehouses.                                  |
| Portfolio        | Account revenue relative to its manager's portfolio and largest-account concentration.              |

Money uses integer cents; ratios use basis points. Tenant and soft-delete policies apply to roots and related records. The business clock is fixed at **2026-10-01**. Complete aggregates use all eligible children regardless of the displayed child page.

The dashboard starts without filtering or ordering. Visible columns determine `select`; relation toggles add nested selections. Sort arrows add or clear `orderBy`. Filter editors use the declared operand schemas, and invalid drafts stop requests. The selected response remains inferred from each literal query. See the [progressive query API examples](docs/query-api.md) and [twelve MongoDB counterparts](docs/query-comparisons.md).

## Adira and plain MongoDB

The [twelve executable comparisons](docs/query-comparisons.md) show both implementations side by side. Adira selects declared fields and relations; the native functions explicitly project, aggregate, join, and page the same data.

| Resource | Examples                                                                                                                                                                                                                                 | Plain MongoDB work                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Accounts | [Directory](docs/queries/accounts.md#account-directory), [credit limits](docs/queries/accounts.md#credit-limits), [manager](docs/queries/accounts.md#account-managers), [revenue](docs/queries/accounts.md#account-revenue)              | `find`/projection, numeric predicates, nullable join, complete order grouping.           |
| Orders   | [Statuses](docs/queries/orders.md#order-statuses), [net amount](docs/queries/orders.md#order-net), [items](docs/queries/orders.md#order-items), [priority](docs/queries/orders.md#order-priorities)                                      | OR predicates, native arithmetic, per-parent child pages, compute before sorting/paging. |
| Products | [Active products](docs/queries/products.md#active-products), [warehouses](docs/queries/products.md#product-warehouses), [available stock](docs/queries/products.md#available-stock), [stock cover](docs/queries/products.md#stock-cover) | Boolean predicates, grouped stock, warehouse counts, complete sales/stock joins.         |

## Demo boundary

`harness/` owns the private database, deterministic seeding, trusted tenant header, HTTP instrumentation, fixed workloads, and benchmark scheduling. These are example infrastructure. The tenant header is a local demo convention.

The control generator and React state/rendering helpers are also example code. Generated operand parsers are headless; the app chooses its widgets and updates. The shadcn components live in [frontend/components/ui](frontend/components/ui/button.tsx).

`server/accounts/`, `server/orders/`, and `server/products/` contain the application's query implementations, custom MongoDB providers, and business rules. Adira plans and validates their declared dependencies; their formulas and raw aggregation bodies remain application-owned.

## Recorded benchmarks

Concurrency-1 median HTTP milliseconds from the original medium reports. Each row is a separate experiment; links retain its controls and complete results.

| Change                                                                    | Representative view |                                                                                           Adira before → after | Native after |
| ------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------: | -----------: |
| [Predicate pushdown](reports/predicate-pushdown-comparison.md)            | Revenue & margin    | [837.3](reports/predicate-pushdown-before/report.json) → [296.5](reports/predicate-pushdown-after/report.json) |         58.0 |
| [Page before display enrichment](reports/native-pagination-comparison.md) | Account 360°        |   [396.0](reports/native-pagination-before/report.json) → [167.1](reports/native-pagination-after/report.json) |         29.2 |
| [Index-compatible predicates](reports/index-lowering-comparison.md)       | Order operations    |         [205.8](reports/index-lowering-before/report.json) → [118.1](reports/index-lowering-after/report.json) |         22.8 |
| [Separate revenue and cost](reports/split-cost-comparison.md)             | Revenue & margin    |                 [344.4](reports/split-cost-before/report.json) → [183.3](reports/split-cost-after/report.json) |         53.8 |
| [Bulk count/sum](reports/bulk-reductions-comparison.md)                   | Service risk        |       [735.6](reports/bulk-reductions-before/report.json) → [330.6](reports/bulk-reductions-after/report.json) |         65.7 |
| [Application query rewrite](reports/numeric-and-demo-query-comparison.md) | Revenue & margin    | [432.1](reports/demo-query-rewrite-before/report.json) → [101.0](reports/demo-query-rewrite-after/report.json) |         61.4 |
| [Shared stock provider](reports/advanced-expressivity-analysis.md)        | Fulfillment         |                                      2,797.0 → [363.7](reports/advanced-expressivity-medium-final/report.json) |        134.8 |
| [Compatible reduction fusion](reports/reduction-fusion-analysis.md)       | Revenue quality     |                                                   [298.3 → 139.1](reports/reduction-fusion-paired/report.json) |         68.0 |

The [initial baseline](reports/local-medium/report.json) measured revenue/margin at 1,607.4 ms and native at 72.8 ms. Later experiments changed both library execution and application query strategies. Results include regressions: index lowering moved service risk from 816.0 to 951.6 ms. The native reference remains faster in these measured comparisons.

The [benchmark index](docs/benchmarks.md) links every stage, raw samples, traces, audits, and preliminary trials. The latest paired fusion report records 720 matching timed responses and revenue-quality commands falling from 22 to 10. These are local warm-cache measurements, not production capacity estimates.

## Checks

```sh
npm run stress:test
npm exec -w examples/stress -- playwright install chromium
npm run test:browser -w examples/stress
```

The tests check exact query-pair parity, policies, dependency pruning, validation, pagination, inferred types, and desktop/mobile control behavior. [HANDOFF.md](HANDOFF.md) contains development, benchmark, and maintenance guidance.
