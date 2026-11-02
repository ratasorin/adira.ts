/** Compile-time checks of the actual callbacks, controls, transport, and table. */
import { schema, type ReadData } from "@n/adira.core.ts";
import { AccountResource, ProductResource } from "../../contracts/resources";
import { DataTable } from "../../frontend/components/data-table";
import { operatorFor } from "../../frontend/controls/filter-controls";
import type { FilterDraft } from "../../frontend/controls/filter-state";
import {
  booleanParser,
  numberParser,
  type InputParser,
} from "../../frontend/controls/input-controls";
import { deriveQuery, when } from "../../frontend/controls/query";
import {
  appendColumns,
  columnsFor,
  type CollectionInputs,
} from "../../frontend/controls/table-controls";
import type { ReportRow as ExampleReportRow } from "../../frontend/examples/queries";
import {
  AccountResourceFilters as filters,
  ProductResourceFilters as productFilters,
} from "../../frontend/generated/controls";
import { AccountResourceFilterRules as rules } from "../../frontend/generated/dashboard-filters";
import { getAccounts } from "../../frontend/lib/api";
import { accountInputs, accountQuery } from "../../frontend/queries/accounts";
import { agentInputs, agentQuery } from "../../frontend/queries/relations";
import { screens } from "../../frontend/screens";
import { type AccountRow } from "../../frontend/screens/accounts";
import { type ProductRow } from "../../frontend/screens/products";

type Account = typeof AccountResource;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;
type CallbackRow = ReadData<
  Account,
  ReturnType<typeof accountQuery>
>["rows"][number];
type CallbackName = Expect<Equal<CallbackRow["name"], string | undefined>>;
type CallbackNumber = Expect<
  Equal<CallbackRow["riskScore"], number | undefined>
>;
type CallbackNullable = Expect<
  Equal<CallbackRow["recentOrderAverage"], number | null | undefined>
>;
type CallbackChild = Expect<
  Equal<
    NonNullable<CallbackRow["orders"]>[number]["priority"],
    number | undefined
  >
>;
type CallbackManager = Expect<
  Equal<NonNullable<CallbackRow["manager"]>["name"], string | undefined>
>;

// Even an entirely conditional selection retains its field types without page/where.
const conditionalQuery = deriveQuery(
  AccountResource,
  (values: { name: boolean }) => ({
    select: { name: when(values.name, () => true) },
  }),
);
type ConditionalRow = ReadData<
  Account,
  ReturnType<typeof conditionalQuery>
>["rows"][number];
type ConditionalName = Expect<
  Equal<ConditionalRow["name"], string | undefined>
>;

const cardQuery = deriveQuery(
  AccountResource,
  (values: { showRisk: boolean }) => ({
    select: {
      name: true,
      riskScore: when(values.showRisk, () => true),
    },
  }),
);
type CardRow = ReadData<Account, ReturnType<typeof cardQuery>>["rows"][number];
type RequiredName = Expect<Equal<CardRow["name"], string>>;
type OptionalRisk = Expect<Equal<CardRow["riskScore"], number | undefined>>;
type OptionalReportOrders = Expect<
  Equal<{} extends Pick<ExampleReportRow, "orders"> ? true : false, true>
>;
type ExampleOrder = NonNullable<ExampleReportRow["orders"]>[number];
type RequiredOrderNumber = Expect<Equal<ExampleOrder["number"], string>>;
type OptionalOrderItems = Expect<
  Equal<{} extends Pick<ExampleOrder, "items"> ? true : false, true>
>;
type ExampleItem = NonNullable<ExampleOrder["items"]>[number];
type RequiredQuantity = Expect<Equal<ExampleItem["quantity"], number>>;
type NullableProduct = Expect<
  Equal<ExampleItem["product"], { readonly sku: string } | null>
>;

const scalarWhenQuery = deriveQuery(AccountResource, (show: boolean) => ({
  select: { name: true, riskScore: when(show, () => true) },
  where: when(show, () => ({ hasRecentEscalation: { $eq: false } })),
  orderBy: when(show, () => ({ name: "asc" })),
  page: when(show, () => ({ limit: 5, offset: 0 })),
}));
type ScalarWhenRow = ReadData<
  Account,
  ReturnType<typeof scalarWhenQuery>
>["rows"][number];
type ScalarWhenName = Expect<Equal<ScalarWhenRow["name"], string>>;
type ScalarWhenRisk = Expect<
  Equal<ScalarWhenRow["riskScore"], number | undefined>
>;

const fixedQuery = deriveQuery(AccountResource, () => ({
  select: { name: true },
}));
const defaultQuery = deriveQuery(
  AccountResource,
  (controls: { showRisk: boolean } = { showRisk: false }) => ({
    select: { name: true, riskScore: when(controls.showRisk, () => true) },
  }),
);
const rangeQuery = deriveQuery(
  AccountResource,
  (minimum: number, maximum: number) => ({
    select: { name: true },
    where: { riskScore: { $gte: minimum, $lt: maximum } },
  }),
);
type FixedArguments = Expect<Equal<Parameters<typeof fixedQuery>, []>>;
type RangeArguments = Expect<
  Equal<Parameters<typeof rangeQuery>, [number, number]>
>;

export async function checkResponseTypes() {
  const result = await getAccounts(accountQuery(accountInputs()));
  const row = result.rows[0];
  const name: string | undefined = row.name;
  const priority: number | undefined = row.orders?.[0]?.priority;
  const average: number | null | undefined = row.recentOrderAverage;
  // @ts-expect-error Actual dynamic response values remain schema-typed.
  const wrongType: string = row.riskScore;
  // @ts-expect-error A toggled column can be absent.
  const requiredName: string = row.name;
  // @ts-expect-error Account rows have no product SKU.
  row.sku;
  // @ts-expect-error Filter-only predicates are not response fields.
  row.hasRecentEscalation;

  const card = await getAccounts(cardQuery({ showRisk: true }));
  const cardName: string = card.rows[0].name;
  // @ts-expect-error This callback never selects region.
  card.rows[0].region;
  // @ts-expect-error A dynamic selection still has optional risk.
  const cardRisk: number = card.rows[0].riskScore;
  return {
    name,
    priority,
    average,
    cardName,
    wrongType,
    requiredName,
    cardRisk,
  };
}

export function checkControlTypes() {
  fixedQuery();
  defaultQuery();
  defaultQuery({ showRisk: true });
  rangeQuery(40, 80);
  // @ts-expect-error A callback with no parameters does not accept extra values.
  fixedQuery({});
  // @ts-expect-error Required callback arguments remain required.
  rangeQuery(40);
  // @ts-expect-error Callback argument types survive the wrapper.
  rangeQuery("high", 80);
  deriveQuery(ProductResource, () => ({
    select: {
      name: true,
      // @ts-expect-error The resource argument cannot widen to fit an invalid callback.
      riskScore: true,
    },
  }));
  deriveQuery(AccountResource, () => ({
    // @ts-expect-error Contextual typing rejects non-selection Boolean flags.
    select: { name: false },
  }));
  deriveQuery(AccountResource, () => ({
    select: { name: true },
    // @ts-expect-error Exact callback checking rejects extra top-level query keys.
    groupBy: ["region"],
  }));
  deriveQuery(AccountResource, () => ({
    select: { name: true },
    where: {
      riskScore: { $gte: 40 },
      // @ts-expect-error Extra filter fields are rejected alongside valid fields.
      unsupported: { $eq: "value" },
    },
  }));
  deriveQuery(AccountResource, () => ({
    select: {
      name: true,
      // @ts-expect-error Computed scalar selections do not accept arguments.
      recentOrderAverage: { since: 123 },
    },
  }));
  // @ts-expect-error Callback authoring uses the public API's exact field checks.
  deriveQuery(AccountResource, () => ({ select: { name: true, sku: true } }));
  deriveQuery(AccountResource, () => ({
    select: { name: true },
    // @ts-expect-error Callback filters reject unapproved operators.
    where: { hasRecentEscalation: { $gte: 10 } },
  }));
  deriveQuery(AccountResource, () => ({
    select: {
      manager: {
        select: { name: true },
        // @ts-expect-error Single-record includes cannot have pagination.
        page: { limit: 5 },
      },
    },
  }));
  const state = screens.accounts.initial();
  const predicate = filters.hasRecentEscalation.$eq;
  const booleanValue: boolean = predicate.parse(true);
  const numericValue: number = filters.riskScore.$gte.parseText("45");
  const regions: readonly string[] = filters.region.$in.parseText("EU, NA");
  const nullable: number | null = filters.recentOrderAverage.$eq.parse(null);
  const parsed = predicate.safeParseText("false");
  if (parsed.success) {
    const value: boolean = parsed.value;
    // @ts-expect-error Boolean parsing retains the declared operand type.
    const wrong: number = parsed.value;
    void value;
    void wrong;
  }
  // @ts-expect-error Parse failures do not expose a value before narrowing.
  parsed.value;
  // @ts-expect-error This predicate approves equality only.
  filters.hasRecentEscalation.$gte;
  // @ts-expect-error Formatting requires the declared Boolean operand.
  predicate.format("yes");
  // @ts-expect-error Numeric filter operands stay numeric.
  filters.riskScore.$gte.format("high");
  // @ts-expect-error Membership requires a list.
  filters.region.$in.format("EU");
  // @ts-expect-error Numeric comparisons exclude null.
  filters.recentOrderAverage.$gte.format(null);
  // @ts-expect-error Parsers for different fields and operators are distinct.
  const wrongDescriptor: typeof predicate = filters.riskScore.$gte;
  // @ts-expect-error Public descriptors do not own rendering.
  predicate.render();
  // @ts-expect-error Public descriptors do not bind application state.
  predicate.bind;
  // @ts-expect-error Public descriptors do not require a draft representation.
  predicate.create;
  const booleanDraft = rules.hasRecentEscalation.$eq.value(true);
  const numeric = rules.riskScore.$gte.value(45);
  // @ts-expect-error The dashboard's optional draft helper retains its operand type.
  rules.hasRecentEscalation.$eq.value("yes");
  // @ts-expect-error Drafts for different fields and operands remain distinct.
  const wrongDraft: FilterDraft<Account, "hasRecentEscalation", "$eq"> =
    numeric;
  void [
    booleanValue,
    numericValue,
    regions,
    nullable,
    wrongDescriptor,
    booleanDraft,
    wrongDraft,
  ];
  // @ts-expect-error Visibility is derived from scalar fields.
  state.columns.orders = true;
  // @ts-expect-error Unknown columns are unavailable.
  state.columns.urgentOrders = true;
  // @ts-expect-error Relations cannot be sorted.
  state.orderBy = { orders: "asc" };
  // @ts-expect-error Production callbacks retain their input resource schema.
  screens.products.query(state);
  screens.accounts.bind(
    state,
    // @ts-expect-error Production bindings reject a setter for another resource.
    (next: CollectionInputs<typeof ProductResource>) => {
      void next;
    },
  );
  // @ts-expect-error Single-record control values have no pagination.
  agentInputs().limit = 5;
  // @ts-expect-error Single-record literal queries have no orderBy.
  agentQuery(agentInputs()).orderBy;
  // @ts-expect-error Manager requires single-agent controls.
  state.manager = screens.orders.initial();

  const column = columnsFor<Account, AccountRow>();
  column.sortable("name", (direction) => ({ name: direction }));
  column.relation("orders");
  // @ts-expect-error Relation accessors reject scalar fields.
  column.relation("name");
  // @ts-expect-error Relation accessors reject fields outside the resource.
  column.relation("inventory");
  // @ts-expect-error Relation accessors require a field selected by the query.
  columnsFor<Account, CardRow>().relation("orders");
  // @ts-expect-error Accessors cannot reference fields outside the response.
  column.value("sku");
  // @ts-expect-error Relations do not have scalar table sorting.
  column.sortable("orders", (direction) => ({ name: direction }));
  // @ts-expect-error The sort expression must match the column's field.
  column.sortable("name", (direction) => ({ region: direction }));
  const productColumn = columnsFor<typeof ProductResource, ProductRow>();
  // @ts-expect-error Active is not declared sortable.
  productColumn.sortable("active", (direction) => ({ active: direction }));
  const view = screens.accounts.bind(state, () => {});
  const extended = appendColumns(
    view,
    when(true, () => column.relation("orders")),
  );
  // @ts-expect-error Appending columns preserves the table's checked row type.
  extended.columns[0].read({ name: 123 });
  appendColumns(view, {
    key: "wrong",
    label: "Wrong",
    // @ts-expect-error Extra column accessors cannot widen the table's row type.
    read: (row: { name: number }) => row.name,
    sorting: undefined,
  });
  const accountRows: AccountRow[] = [];
  const validTable = (
    <DataTable
      rows={accountRows}
      columns={view.columns}
      loading={false}
      offset={0}
      onOpen={() => {}}
    />
  );
  const wrongTable = DataTable({
    rows: [{ name: 123 }],
    // @ts-expect-error Shared table props preserve the row/accessor relationship.
    columns: view.columns,
    loading: false,
    offset: 0,
    onOpen: () => {},
  });
  // @ts-expect-error Boolean schemas cannot use numeric parsers.
  numberParser(schema.boolean());
  operatorFor<Account>()({
    field: "hasRecentEscalation",
    operator: "$eq",
    // @ts-expect-error A numeric parser cannot widen the declared Boolean operand.
    input: numberParser(schema.number()),
  });
  const numericParser: InputParser<number> = numberParser(schema.number());
  // @ts-expect-error A numeric parser cannot become a Boolean parser.
  const wrongParser: InputParser<boolean> = numericParser;
  // @ts-expect-error Boolean formatters reject text state.
  booleanParser(schema.boolean()).format("true");
  void wrongParser;
  // @ts-expect-error Another resource's descriptors cannot invent fields here.
  productFilters.riskScore;
  return { validTable, wrongTable };
}
