/** Tutorial examples, checked by the frontend build. Loaders issue HTTP requests when called. */
import type { InferRow, OperatorValue, ReadQuery } from "@n/adira.core.ts";
import { useState, type FormEvent } from "react";
import { AccountResource, OrderResource } from "../../contracts/resources";
import { deriveQuery, when } from "../controls/query";
import { columnsFor } from "../controls/table-controls";
import { AccountResourceFilters as filters } from "../generated/controls";
import { getAccounts } from "../lib/api";

type Account = typeof AccountResource;
type Order = typeof OrderResource;
type RiskMinimum = OperatorValue<Account["fields"]["riskScore"], "$gte">;
type NameOrder = NonNullable<ReadQuery<Account>["orderBy"]>["name"];
type PriorityOrder = NonNullable<ReadQuery<Order>["orderBy"]>["priority"];

// 1. Easy: a fixed literal selection.
export const loadDirectory = () =>
  getAccounts({
    select: { id: true, name: true, region: true },
    where: { region: { $eq: "EU" } },
    page: { limit: 10 },
  });
export type DirectoryRow = InferRow<typeof loadDirectory>;

// 2. Moderate: controls supply typed values to a literal query callback.
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

// 3. Complex: compose a child literal callback, Boolean filters, and nested includes.
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

// 4. A whole-query branch produces a response union that can be narrowed.
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

// 5. A schema-derived parser feeds a value from application-owned form state.
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

export function RiskCardPreview() {
  const [riskText, setRiskText] = useState("45");
  const [showRisk, setShowRisk] = useState(false);
  const [nameOrder, setNameOrder] = useState<NameOrder>();
  const result = riskInput.safeParseText(riskText);
  let preview: string;
  if (!result.success) {
    preview = result.error;
  } else {
    try {
      preview = JSON.stringify(
        cardQuery({
          ...initialCardControls,
          showRisk,
          nameOrder,
          minimumRisk: result.value,
        }),
        null,
        2,
      );
    } catch (error) {
      preview = error instanceof Error ? error.message : String(error);
    }
  }
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={showRisk}
          onChange={(event) => setShowRisk(event.target.checked)}
        />
        Show risk
      </label>
      <input
        aria-label="Minimum risk"
        type="number"
        value={riskText}
        aria-invalid={!result.success}
        onChange={(event) => setRiskText(event.currentTarget.value)}
      />
      <button
        type="button"
        onClick={() =>
          setNameOrder((current) => (current === "asc" ? undefined : "asc"))
        }
      >
        Name ↑
      </button>
      <button
        type="button"
        onClick={() =>
          setNameOrder((current) => (current === "desc" ? undefined : "desc"))
        }
      >
        Name ↓
      </button>
      <pre>{preview}</pre>
    </>
  );
}

/** An uncontrolled form uses the same parser only when the user submits. */
export function RiskCardForm() {
  const [status, setStatus] = useState("");
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get("minimumRisk");
    if (typeof text !== "string") {
      setStatus("Enter a minimum risk.");
      return;
    }
    const result = riskInput.safeParseText(text);
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
    <form onSubmit={handleSubmit}>
      <label>
        Minimum risk
        <input name="minimumRisk" type="number" defaultValue="45" />
      </label>
      <button type="submit">Apply</button>
      <p role="status">{status}</p>
    </form>
  );
}

// Table accessors use the inferred response type rather than a hand-maintained row interface.
const cardColumn = columnsFor<Account, CardRow>();
export const cardNameColumn = cardColumn.sortable("name", (direction) => ({
  name: direction,
}));
export const cardRiskColumn = cardColumn.value("riskScore");

/** Deliberate compiler examples. Never invoked. */
export function checkExampleTypes(
  directory: DirectoryRow,
  card: CardRow,
  report: ReportRow,
  mode: ModeRow,
) {
  const name: string = directory.name;
  const risk: number | undefined = card.riskScore;
  const optionalAverage: number | null | undefined = card.recentOrderAverage;
  const average: number | null = report.recentOrderAverage;
  const manager: { name: string } | null = report.manager;
  const priority: number | undefined = report.orders?.[0]?.priority;
  const quantity: number | undefined = report.orders?.[0]?.items?.[0]?.quantity;
  const sku: string | undefined = report.orders?.[0]?.items?.[0]?.product?.sku;
  // @ts-expect-error A fixed selection excludes unselected fields.
  directory.riskScore;
  // @ts-expect-error Account rows have no product SKU field.
  directory.sku;
  // @ts-expect-error Runtime checkbox-controlled fields remain optional.
  card.riskScore.toFixed(2);
  // @ts-expect-error The selected average can be null.
  report.recentOrderAverage.toFixed(2);
  // @ts-expect-error A selected nullable single relation still needs a null check.
  report.manager.name;
  // @ts-expect-error An included order exposes only its selected fields.
  report.orders?.[0]?.id;
  // @ts-expect-error A selected product exposes SKU, not name.
  report.orders?.[0]?.items?.[0]?.product?.name;
  // @ts-expect-error Filtering risk does not add risk to the response.
  report.riskScore;
  // @ts-expect-error A named predicate is filter-only.
  report.hasRecentEscalation;
  // @ts-expect-error A branch-dependent response must be narrowed first.
  mode.riskScore;
  cardQuery({
    ...initialCardControls,
    // @ts-expect-error A numeric comparison cannot consume text state.
    minimumRisk: "high",
  });
  cardQuery({
    ...initialCardControls,
    // @ts-expect-error Sort directions are constrained by the public query type.
    nameOrder: "up",
  });
  // @ts-expect-error Formatting accepts the declared operand type.
  riskInput.format("high");
  const parsed = riskInput.safeParseText("45");
  // @ts-expect-error Parsed values are available only after checking success.
  parsed.value;
  // @ts-expect-error The card callback never selects region.
  cardColumn.value("region");
  return {
    name,
    risk,
    optionalAverage,
    average,
    manager,
    priority,
    quantity,
    sku,
  };
}
