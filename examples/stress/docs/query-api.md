# Query API examples

These examples progress from a fixed query to nested, control-driven queries. Their complete implementations and deliberate compiler rejection cases live in [frontend/examples/queries.tsx](../frontend/examples/queries.tsx), which the frontend build checks. Loader functions send requests when called; their row types are inferred from the actual API response.

Literal arguments passed to `getAccounts` and literal results returned by `deriveQuery(resource, callback)` already have the public resource as their typing context. They need no `satisfies ReadQuery` or `true as const`. The callback helper retains the inferred selection, checks exact query keys, and validates the request against the schema and limits before returning a normalized query. `getAccounts(query)` sends it and derives its response from that selection.

The resource argument fixes the schema; the callback's `const Q` type parameter preserves its literal return type. `ExactReadQuery` rejects unsupported keys even alongside valid keys. The controls parameter describes the page's input values; the query return type is inferred.

`when(condition, () => part)` adds a lazy conditional value to an ordinary query literal. It preserves the returned literal's fields and selection flags and returns `undefined` when disabled. Put it directly at the selected field or relation: `riskScore: when(showRisk, () => true)` or `orders: when(includeOrders, () => orderQuery(controls))`. A disabled callback does not run, so hidden child inputs do not build or validate a child query.

`deriveQuery` uses the core `normalizeReadQuery` validator to omit `undefined` selection entries and optional `where`, `orderBy`, or `page` properties recursively through included queries. Returned queries contain only the enabled parts. Unknown keys are rejected before omission, and each enabled selection must still contain a field. Filter operands are preserved, including `false`, `0`, and `null`. A conditional selection becomes an optional response property; an explicit `undefined` selection disappears from its row type. Direct literal API requests support the same omissions through JSON serialization, server validation, and selected-response parsing.

`InferRow<typeof loadDirectory>` derives a row directly from the loader. The same helper also accepts its promised or resolved response. It preserves selected fields, optional properties, nested types, nullability, and response unions. Branches without `rows`, such as error responses, contribute no row type; callers still narrow the actual response before accessing its rows.

The snippets use the imports from `frontend/examples/queries.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import type { InferRow, OperatorValue, ReadQuery } from "@n/adira.core.ts";
import { AccountResource, OrderResource } from "../../contracts/resources";
import { getAccounts } from "../lib/api";
import { AccountResourceFilters as filters } from "../generated/controls";
import { deriveQuery, when } from "../controls/query";
import { columnsFor } from "../controls/table-controls";

type Account = typeof AccountResource;
type Order = typeof OrderResource;
type RiskMinimum = OperatorValue<Account["fields"]["riskScore"], "$gte">;
type NameOrder = NonNullable<ReadQuery<Account>["orderBy"]>["name"];
type PriorityOrder = NonNullable<ReadQuery<Order>["orderBy"]>["priority"];
```

1. **Easy: a fixed projection and one filter.**

   ```ts
   export const loadDirectory = () =>
     getAccounts({
       select: { id: true, name: true, region: true },
       where: { region: { $eq: "EU" } },
       page: { limit: 10 },
     });
   export type DirectoryRow = InferRow<typeof loadDirectory>;
   ```

   The inferred `DirectoryRow` contains exactly `id: string`, `name: string`, and `region: string`. Its keys come from `select`; the filter decides which rows are returned.

   ```ts
   const directory = await loadDirectory();
   for (const row of directory.rows) {
     row.name.toUpperCase(); // string
     row.region.toUpperCase(); // string
     // @ts-expect-error This query does not select riskScore.
     row.riskScore;
   }
   ```

   `id` is included here because the query selects it explicitly. A query that selects only `name` returns only `name`. Required fields describe each returned row; the array can still be empty.

2. **Moderate: checkboxes, a numeric filter, and sort arrows.**

   ```ts
   export interface CardControls {
     showRisk: boolean;
     showAverage: boolean;
     minimumRisk?: RiskMinimum;
     nameOrder?: NameOrder;
     limit: number;
     offset: number;
   }
   export const initialCardControls: CardControls = {
     showRisk: false,
     showAverage: false,
     limit: 20,
     offset: 0,
   };
   export const cardQuery = deriveQuery(
     AccountResource,
     (controls: CardControls) => ({
       select: {
         name: true,
         riskScore: when(controls.showRisk, () => true),
         recentOrderAverage: when(controls.showAverage, () => true),
       },
       where:
         controls.minimumRisk === undefined
           ? undefined
           : { riskScore: { $gte: controls.minimumRisk } },
       orderBy: controls.nameOrder ? { name: controls.nameOrder } : undefined,
       page: { limit: controls.limit, offset: controls.offset },
     }),
   );

   export const loadCard = (controls: CardControls) =>
     getAccounts(cardQuery(controls));
   export type CardRow = InferRow<typeof loadCard>;
   ```

   `RiskMinimum` comes from the declared `riskScore` / `$gte` operand. `NameOrder` comes from the public query's `name` ordering type. The callback receives Boolean visibility controls and numeric pagination values. It emits ordinary query literals with lazy selections and optional properties; conditional spreads are unnecessary.

   ```ts
   const cards = await loadCard({
     ...initialCardControls,
     showRisk: true,
     showAverage: true,
     minimumRisk: 50,
   });
   for (const row of cards.rows) {
     const name: string = row.name;
     const risk: number | undefined = row.riskScore;
     const average: number | null | undefined = row.recentOrderAverage;
     // @ts-expect-error Checkbox-controlled fields can be absent.
     row.riskScore.toFixed(2);
   }
   ```

   `name` is always selected, so it is required. `riskScore` depends on a checkbox, so it is optional and keeps its numeric value type. `recentOrderAverage` can be omitted by the checkbox or returned as `null` under its schema, so both `undefined` and `null` appear in its type.

   The callback parameter declares `showRisk: boolean`. Passing `showRisk: true` to that callback does not specialize its return type; `riskScore` remains optional. A fixed literal containing `riskScore: true` makes that property required.

   `initialCardControls` has no ordering. An arrow handler sets `nameOrder` to `"asc"` or `"desc"`; clearing it removes `orderBy`. The query callback checks that direction against the schema. The dashboard's existing column bindings also reset offsets and clear sorting when the sorted column is hidden.

   ```ts
   cardQuery({
     ...initialCardControls,
     // @ts-expect-error Numeric filter operands cannot be text.
     minimumRisk: "high",
   });
   cardQuery({
     ...initialCardControls,
     // @ts-expect-error Sort directions are asc or desc.
     nameOrder: "up",
   });
   ```

3. **Complex: compose a child callback, Boolean filters, and nested includes.**

   ```ts
   export interface OrdersControls {
     minimumPriority: OperatorValue<Order["fields"]["priority"], "$gte">;
     showItems: boolean;
     priorityOrder?: PriorityOrder;
     limit: number;
     offset: number;
     itemLimit: number;
   }
   export const priorityOrdersQuery = deriveQuery(
     OrderResource,
     (controls: OrdersControls) => ({
       select: {
         number: true,
         priority: true,
         items: when(controls.showItems, () => ({
           select: {
             quantity: true,
             product: { select: { sku: true } },
           },
           page: { limit: controls.itemLimit, offset: 0 },
         })),
       },
       where: { priority: { $gte: controls.minimumPriority } },
       orderBy: controls.priorityOrder
         ? { priority: controls.priorityOrder }
         : undefined,
       page: { limit: controls.limit, offset: controls.offset },
     }),
   );

   export interface ReportControls {
     regions: OperatorValue<Account["fields"]["region"], "$in">;
     minimumRisk: RiskMinimum;
     includeOrders: boolean;
     orders: OrdersControls;
     limit: number;
     offset: number;
   }
   export const reportQuery = deriveQuery(
     AccountResource,
     (controls: ReportControls) => ({
       select: {
         name: true,
         region: true,
         recentOrderAverage: true,
         manager: { select: { name: true } },
         orders: when(controls.includeOrders, () =>
           priorityOrdersQuery(controls.orders),
         ),
       },
       where: {
         $and: [
           { region: { $in: controls.regions } },
           {
             $or: [
               { riskScore: { $gte: controls.minimumRisk } },
               { hasRecentEscalation: { $eq: true } },
             ],
           },
           { $not: { tier: { $eq: "starter" } } },
         ],
       },
       page: { limit: controls.limit, offset: controls.offset },
     }),
   );

   export const loadReport = (controls: ReportControls) =>
     getAccounts(reportQuery(controls));
   export type ReportRow = InferRow<typeof loadReport>;
   ```

   The account query requires a matching region, either sufficient risk or the approved escalation predicate, and a tier other than Starter. The orders callback independently filters included orders by priority. Enabling it affects the included payload; this child filter does not require an account to have a matching order.

   ```ts
   const report = await loadReport({
     regions: ["EU", "NA"],
     minimumRisk: 50,
     includeOrders: true,
     orders: {
       minimumPriority: 80,
       showItems: true,
       limit: 5,
       offset: 0,
       itemLimit: 3,
     },
     limit: 10,
     offset: 20,
   });
   ```

   `ReportRow` is inferred from `loadReport`. Its value shape is equivalent to the following explanatory type; the loader itself has no handwritten row annotation:

   ```ts
   type ReportValueShape = {
     name: string;
     region: string;
     recentOrderAverage: number | null;
     manager: { name: string } | null;
     orders?: {
       number: string;
       priority: number;
       items?: {
         quantity: number;
         product: { sku: string } | null;
       }[];
     }[];
   };
   ```

   Root, order, and item pagination are independent. Selected single-record relations such as `manager` and `product` preserve their declared nullability and accept selection and filters, without collection pagination or sorting.

   ```ts
   for (const row of report.rows) {
     const managerName: string | undefined = row.manager?.name;
     const sku: string | undefined = row.orders?.[0]?.items?.[0]?.product?.sku;
     // @ts-expect-error Filtering risk does not select it.
     row.riskScore;
     // @ts-expect-error An included order exposes only selected fields.
     row.orders?.[0]?.id;
     // @ts-expect-error Product selection contains SKU, not name.
     row.orders?.[0]?.items?.[0]?.product?.name;
     // @ts-expect-error A selected manager can still be null.
     row.manager.name;
   }
   ```

   The optional chaining handles omitted relations, empty child arrays, and nullable single-record relations. `hasRecentEscalation` remains filter-only and does not become a response property.

4. **A whole-query branch produces a union of row shapes.**

   ```ts
   export const modeQuery = deriveQuery(
     AccountResource,
     (controls: { mode: "directory" | "risk" }) =>
       controls.mode === "directory"
         ? { select: { name: true, region: true } }
         : {
             select: { name: true, riskScore: true },
           },
   );
   export const loadMode = (controls: { mode: "directory" | "risk" }) =>
     getAccounts(modeQuery(controls));
   export type ModeRow = InferRow<typeof loadMode>;

   export function describeModeRow(row: ModeRow): string {
     return "riskScore" in row
       ? `${row.name}: ${row.riskScore.toFixed(1)}`
       : `${row.name}: ${row.region.toUpperCase()}`;
   }
   ```

   `ModeRow` is `{ name: string; region: string } | { name: string; riskScore: number }`. The `"riskScore" in row` check narrows it to the branch with the required numeric score. Reading `row.riskScore` before narrowing is a compiler error. Choosing a runtime mode keeps the callback's union return type.

5. **Parse form input while owning its rendering and state.**

   Generated descriptors contain the schema and parsers. They have no React dependency, renderer, state setter, or required draft format:

   ```ts
   const riskInput = filters.riskScore.$gte;
   export function cardFromRiskText(text: string) {
     const result = riskInput.safeParseText(text);
     if (!result.success) {
       return { status: "editing", error: result.error } as const;
     }
     return {
       status: "ready",
       query: cardQuery({
         ...initialCardControls,
         minimumRisk: result.value,
       }),
     } as const;
   }
   ```

   `parse(45)` validates a runtime numeric operand. `parseText("45")` converts text and returns a number, throwing on failure. `safeParseText("45")` returns `{ success: true, value: 45 }`; invalid text returns `{ success: false, error: string }`. Check `success` before accessing `value`. `parse("45")` rejects a string: conversion is explicit. The descriptor also exposes `safeParse`, `format`, and its `schema`; it never chooses a widget or an initial value.

   A controlled component can keep ordinary string state and choose when to parse:

   ```tsx
   function RiskEditor() {
     const [text, setText] = useState("45");
     const result = riskInput.safeParseText(text);
     return (
       <label>
         Minimum risk
         <input
           type="number"
           value={text}
           aria-invalid={!result.success}
           onChange={(event) => setText(event.currentTarget.value)}
         />
         {!result.success && <span role="alert">{result.error}</span>}
       </label>
     );
   }
   ```

   An uncontrolled form can read the same value only on submit:

   ```tsx
   function RiskForm() {
     const [status, setStatus] = useState("");
     async function submit(event: FormEvent<HTMLFormElement>) {
       event.preventDefault();
       const raw = new FormData(event.currentTarget).get("minimumRisk");
       if (typeof raw !== "string") {
         setStatus("Enter a minimum risk.");
         return;
       }
       const result = riskInput.safeParseText(raw);
       if (!result.success) {
         setStatus(result.error);
         return;
       }
       try {
         const response = await loadCard({
           ...initialCardControls,
           minimumRisk: result.value,
         });
         setStatus(`${response.rows.length} rows loaded`);
       } catch (error) {
         setStatus(error instanceof Error ? error.message : String(error));
       }
     }
     return (
       <form onSubmit={submit}>
         <input name="minimumRisk" type="number" defaultValue="45" />
         <button type="submit">Apply</button>
         <p role="status">{status}</p>
       </form>
     );
   }
   ```

   A slider or form library can supply numeric values directly to `parse`; raw text state and the dashboard's optional draft helpers are not required. The complete `RiskCardPreview` and `RiskCardForm` components in the checked source demonstrate both approaches. The preview also wires a checkbox and up/down arrows into `cardQuery`.

   For reusable tables, derive accessors from the inferred response:

   ```ts
   const cardColumn = columnsFor<Account, CardRow>();
   cardColumn.sortable("name", (direction) => ({ name: direction }));
   cardColumn.value("riskScore");
   // @ts-expect-error This callback never selects region.
   cardColumn.value("region");
   ```

The guarantees come from different layers:

| Concern                                                                                | Check                                                                                                                        |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Field names, approved operators, operand types, sort fields, and relation query shapes | TypeScript checks the literal and callback against the public resource.                                                      |
| Required, optional, nullable, and branch-dependent response properties                 | Response types are inferred from the selected literal and retained through the API call.                                     |
| Raw form text such as `"45"` or `"high"`                                               | The schema-derived parser returns a typed value or a parsing error; the application chooses how to store and display it.     |
| Page bounds, finite values, nonempty selections, and query budgets                     | `deriveQuery` validates these at runtime before fetching; direct API calls are validated by the server before database work. |
| Returned JSON field values                                                             | The frontend API parser validates selected values against their resource schemas.                                            |

A TypeScript `number` alone does not prove a legal page size: the example's configured maximum is 100. Likewise, these resources declare `region` as a string, so TypeScript does not restrict its values to a fixed list of region codes. Enum restrictions require an enum in the public schema. A selected collection is an array that can be empty.

Keep query literals inside the typed API call or typed callback and let their return types be inferred. A broad `ReadQuery<Account>` return annotation retains the account schema but loses the exact selected subset and required-field information.

A separately declared fragment can widen before it reaches the callback: `const fields = { name: true }` infers a Boolean flag. Such fragments still need a literal-preserving declaration such as `as const` or `satisfies`. The inline query literals shown here receive that context directly from the typed function.

Check every source example and its deliberate compiler rejection cases with:

```sh
npx tsc -p examples/stress/tsconfig.frontend.json
```
