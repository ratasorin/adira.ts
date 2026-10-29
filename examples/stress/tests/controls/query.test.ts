import { schema } from "@n/adira.core.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountResource } from "../../contracts/resources";
import { FilterInput } from "../../frontend/components/filters/filter-input";
import { emptyFilters } from "../../frontend/controls/filter-state";
import {
  booleanParser,
  defineInputParser,
  enumParser,
  listParser,
  nonNullable,
  numberParser,
} from "../../frontend/controls/input-controls";
import { deriveQuery, when } from "../../frontend/controls/query";
import {
  priorityOrdersQuery,
  reportQuery,
  RiskCardForm,
  RiskCardPreview,
} from "../../frontend/examples/queries";
import { AccountResourceFilters as parsers } from "../../frontend/generated/controls";
import {
  AccountResourceFilterEditors as editors,
  AccountResourceFilterRules as filters,
  OrderResourceFilterRules as orderFilters,
  ShipmentResourceFilterRules as shipmentFilters,
} from "../../frontend/generated/dashboard-filters";
import { getAccounts } from "../../frontend/lib/api";
import { accountInputs, accountQuery } from "../../frontend/queries/accounts";
import { orderInputs } from "../../frontend/queries/orders";
import {
  agentInputs,
  shipmentInputs,
  shipmentQuery,
} from "../../frontend/queries/relations";
import { screens } from "../../frontend/screens";
import { bindAccount, type AccountRow } from "../../frontend/screens/accounts";

test("single-call query callbacks preserve no-input, default, and multiple arguments", () => {
  const fixed = deriveQuery(AccountResource, () => ({
    select: { name: true },
  }));
  assert.deepEqual(fixed(), { select: { name: true } });
  let calls = 0;
  const range = deriveQuery(
    AccountResource,
    (minimum: number, maximum: number = 100) => {
      calls++;
      return {
        select: { name: true },
        where: { riskScore: { $gte: minimum, $lt: maximum } },
      };
    },
  );
  assert.equal(calls, 0);
  assert.deepEqual(range(40).where, { riskScore: { $gte: 40, $lt: 100 } });
  assert.deepEqual(range(50, 80).where, { riskScore: { $gte: 50, $lt: 80 } });
  assert.equal(calls, 2);
});

test("tutorial queries omit disabled parts and defer validation of disabled children", () => {
  const orders = {
    minimumPriority: 0,
    showItems: false,
    itemLimit: 0,
    limit: 5,
    offset: 0,
  };
  assert.deepEqual(priorityOrdersQuery(orders), {
    select: { number: true, priority: true },
    where: { priority: { $gte: 0 } },
    page: { limit: 5, offset: 0 },
  });
  assert.throws(
    () => priorityOrdersQuery({ ...orders, showItems: true }),
    /page.limit/,
  );
  const report = {
    regions: ["EU"],
    minimumRisk: 0,
    includeOrders: false,
    orders: { ...orders, limit: 0 },
    limit: 5,
    offset: 0,
  };
  assert.equal("orders" in reportQuery(report).select, false);
  assert.throws(
    () => reportQuery({ ...report, includeOrders: true }),
    /page.limit/,
  );
});

test("literal callbacks request exactly visible fields without implicit ID, filter, or sorting", () => {
  const state = accountInputs();
  state.columns.id = false;
  state.columns.name = true;
  state.columns.region = true;
  assert.deepEqual(accountQuery(state), {
    select: { name: true, region: true },
    page: { limit: 20, offset: 0 },
  });
  state.columns.netRevenueCents = true;
  assert.deepEqual(accountQuery(state).select, {
    name: true,
    region: true,
    netRevenueCents: true,
  });
});

test("bound sort arrows alone set, reverse, and clear sorting; hiding the field clears it", () => {
  let state = { ...screens.accounts.initial(), offset: 40 };
  const view = () =>
    bindAccount(state, (next) => {
      state = next;
    });
  const name = () =>
    view().selection.columns.find((column) => column.key === "name");
  name()?.sorting?.ascending();
  assert.deepEqual(accountQuery(state).orderBy, { name: "asc" });
  assert.equal(state.offset, 0);
  name()?.sorting?.descending();
  assert.deepEqual(accountQuery(state).orderBy, { name: "desc" });
  name()?.sorting?.descending();
  assert.equal("orderBy" in accountQuery(state), false);
  name()?.sorting?.ascending();
  name()?.toggle();
  assert.equal("orderBy" in accountQuery(state), false);
  assert.equal("name" in accountQuery(state).select, false);
});

test("numeric and Boolean input values stay typed in the callback's where value", () => {
  const state = accountInputs();
  state.filters.children = [
    filters.riskScore.$gte.read("45.5"),
    filters.hasRecentEscalation.$eq.value(false),
  ];
  assert.deepEqual(accountQuery(state).where, {
    $and: [
      { riskScore: { $gte: 45.5 } },
      { hasRecentEscalation: { $eq: false } },
    ],
  });
  for (const text of ["high", "", "Infinity"]) {
    state.filters.children = [filters.riskScore.$eq.read(text)];
    assert.throws(() => accountQuery(state), /number/);
  }
  state.filters.children = [filters.hasRecentEscalation.$eq.read("yes")];
  assert.throws(() => accountQuery(state), /Boolean/);
});

test("filter controls preserve nested AND, OR, NOT, membership, and nullable equality", () => {
  const state = accountInputs();
  state.filters = {
    ...emptyFilters<typeof screens.accounts.resource>(),
    negated: true,
    operator: "$or",
    children: [
      filters.region.$in.read("EU, NA"),
      {
        ...emptyFilters<typeof screens.accounts.resource>(),
        children: [
          filters.recentOrderAverage.$eq.value(null),
          filters.riskScore.$lt.value(20),
        ],
      },
    ],
  };
  assert.deepEqual(accountQuery(state).where, {
    $not: {
      $or: [
        { region: { $in: ["EU", "NA"] } },
        {
          $and: [
            { recentOrderAverage: { $eq: null } },
            { riskScore: { $lt: 20 } },
          ],
        },
      ],
    },
  });
});

test("literal includes retain independent collection pages and omit them for single relations", () => {
  const state = accountInputs();
  state.columns.id = false;
  state.columns.name = true;
  state.offset = 20;
  state.includeOrders = true;
  state.orders = orderInputs(5);
  state.orders.columns.id = false;
  state.orders.columns.priority = true;
  state.orders.offset = 10;
  state.orders.filters.children = [orderFilters.priority.$gte.value(80)];
  state.includeManager = true;
  state.manager = agentInputs();
  state.manager.columns.id = false;
  state.manager.columns.name = true;
  assert.deepEqual(accountQuery(state), {
    select: {
      name: true,
      manager: { select: { name: true } },
      orders: {
        select: { priority: true },
        where: { priority: { $gte: 80 } },
        page: { limit: 5, offset: 10 },
      },
    },
    page: { limit: 20, offset: 20 },
  });
  state.orders.orderBy = { priority: "desc" };
  assert.deepEqual(accountQuery(state).select.orders?.orderBy, {
    priority: "desc",
  });
  assert.equal("orderBy" in accountQuery(state), false);
  const manager = bindAccount(state, () => {}).selection.relations.find(
    (relation) => relation.key === "manager",
  );
  assert.equal(manager?.child?.page, undefined);
  assert.equal(
    manager?.child?.selection.columns.some((column) => column.sorting),
    false,
  );
});

test("typed accessors render selected response values and bound controls update projection and page", () => {
  let state = screens.accounts.initial();
  const view = () =>
    bindAccount(state, (next) => {
      state = next;
    });
  view()
    .selection.columns.find((column) => column.key === "netRevenueCents")
    ?.toggle();
  assert.equal(accountQuery(state).select.netRevenueCents, true);
  assert.equal(
    view()
      .columns.find((column) => column.key === "netRevenueCents")
      ?.read({ netRevenueCents: 1234 }),
    1234,
  );
  assert.equal("orderBy" in accountQuery(state), false);
  view().page?.setOffset(40);
  assert.equal(state.offset, 40);
  view().page?.setLimit(5);
  assert.equal(state.limit, 5);
  assert.equal(state.offset, 0);
  view().page?.setOffset(-1);
  assert.equal(state.offset, 0);
});

test("relation columns follow enabled includes and retain their checked accessors", () => {
  const state = screens.accounts.initial();
  const base = bindAccount(state, () => {}).columns.map((column) => column.key);
  state.includeManager = true;
  state.includeOrders = true;
  state.includeTickets = true;
  const included = bindAccount(state, () => {});
  assert.deepEqual(
    included.columns.map((column) => column.key),
    base.concat(["manager", "orders", "tickets"]),
  );
  const row: AccountRow = {
    manager: { name: "Ada" },
    orders: [{ number: "O-1" }],
    tickets: [{ subject: "Delivery" }],
  };
  for (const key of ["manager", "orders", "tickets"] as const) {
    const column = included.columns.find((column) => column.key === key);
    assert.equal(column?.read(row), row[key]);
    assert.equal(column?.sorting, undefined);
  }
  state.includeManager = false;
  assert.deepEqual(
    bindAccount(state, () => {}).columns.map((column) => column.key),
    base.concat(["orders", "tickets"]),
  );
});

test("field and operator menus replace the complete captured editor value", () => {
  let group = emptyFilters<typeof screens.accounts.resource>();
  group.children = [filters.hasRecentEscalation.$eq.value(false)];
  const view = () =>
    editors.bind(group, (next) => {
      group = next;
    });
  const first = view().children[0];
  assert.equal(first.kind, "rule");
  if (first.kind !== "rule") return;
  assert.deepEqual(
    first.rule.operators.map((option) => option.id),
    ["$eq"],
  );
  first.rule.fields.find((field) => field.id === "riskScore")?.choose();
  assert.deepEqual(editors.where(group), { riskScore: { $eq: 0 } });
  group.children = [filters.recentOrderAverage.$eq.value(null)];
  const nullable = view().children[0];
  if (nullable.kind !== "rule") throw new Error("Expected a rule.");
  nullable.rule.operators.find((option) => option.id === "$gte")?.choose();
  assert.deepEqual(editors.where(group), { recentOrderAverage: { $gte: 0 } });
});

test("dashboard inputs preserve incomplete text, Boolean values, and comparison nullability", () => {
  const numeric = filters.riskScore.$gte.read("1.");
  assert.equal(numeric.input.text, "1.");
  assert.deepEqual(numeric.condition(), { riskScore: { $gte: 1 } });
  assert.equal(filters.riskScore.$gte.read("").input.status, "editing");
  const boolean = filters.hasRecentEscalation.$eq.value(false);
  assert.match(
    renderToStaticMarkup(
      createElement(FilterInput, {
        input: boolean.inputProps(() => {}),
        label: "Escalation",
      }),
    ),
    /<option[^>]*selected[^>]*>false<\/option>/,
  );
  assert.doesNotMatch(
    renderToStaticMarkup(
      createElement(FilterInput, {
        input: filters.recentOrderAverage.$gte.value(5).inputProps(() => {}),
        label: "Average",
      }),
    ),
    /type="checkbox"/,
  );
});

test("list, enum, nullable, and Boolean parsers retain their operand types", () => {
  const numbers = listParser(numberParser(schema.number()));
  assert.deepEqual(numbers.parseText("1, 2\n3"), [1, 2, 3]);
  assert.deepEqual(numbers.parseText("[1,2]"), [1, 2]);
  assert.deepEqual(numbers.parseText(""), []);
  assert.throws(() => numbers.parseText('[1,"oops"]'));
  const choices = enumParser(schema.enum(["EU", "NA"]));
  assert.equal(choices.parseText("EU"), "EU");
  assert.throws(() => choices.parseText("APAC"));
  const nullable = numberParser(schema.nullable(schema.number()));
  assert.equal(nullable.parse(null), null);
  assert.throws(() =>
    nonNullable(schema.nullable(schema.number())).parse(null),
  );
  assert.equal(booleanParser(schema.boolean()).parseText("false"), false);
  assert.throws(() => booleanParser(schema.boolean()).parseText("yes"));
});

test("headless parsers validate controlled text and submitted form values", () => {
  const risk = parsers.riskScore.$gte;
  assert.equal(risk.parse(45), 45);
  assert.throws(() => risk.parse("45"), /number/);
  assert.deepEqual(risk.safeParseText("45.5"), { success: true, value: 45.5 });
  for (const text of ["", "high", "Infinity"]) {
    const result = risk.safeParseText(text);
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.error, /number/);
  }
  assert.deepEqual(parsers.hasRecentEscalation.$eq.safeParseText("false"), {
    success: true,
    value: false,
  });
  assert.deepEqual(parsers.recentOrderAverage.$eq.safeParse(null), {
    success: true,
    value: null,
  });
  assert.equal(parsers.recentOrderAverage.$gte.safeParse(null).success, false);
  const form = new FormData();
  form.set("minimumRisk", "80");
  const raw = form.get("minimumRisk");
  assert.equal(typeof raw, "string");
  if (typeof raw !== "string") throw new Error("Expected a text field.");
  const result = risk.safeParseText(raw);
  if (!result.success) throw new Error(result.error);
  const query = deriveQuery(AccountResource, () => ({
    select: { name: true },
    where: { riskScore: { $gte: result.value } },
  }));
  assert.deepEqual(query(), {
    select: { name: true },
    where: { riskScore: { $gte: 80 } },
  });
  assert.match(
    renderToStaticMarkup(createElement(RiskCardPreview)),
    /aria-label="Minimum risk"/,
  );
  assert.match(
    renderToStaticMarkup(createElement(RiskCardForm)),
    /name="minimumRisk"[^>]*value="45"/,
  );
});

test("custom text codecs still validate schema constraints without choosing initial state", () => {
  const positive = schema.custom((raw: unknown) => {
    const value = schema.number().parse(raw);
    if (value <= 0) throw new Error("Expected a positive number.");
    return value;
  });
  const fraction = defineInputParser({
    schema: positive,
    parseText: (text) => Number(text) / 100,
    format: (value) => String(value * 100),
  });
  assert.deepEqual(fraction.safeParseText("25"), {
    success: true,
    value: 0.25,
  });
  assert.equal(fraction.format(0.25), "25");
  assert.deepEqual(fraction.safeParseText("0"), {
    success: false,
    error: "Expected a positive number.",
  });
  assert.equal(fraction.safeParseText("oops").success, false);
  assert.throws(() => fraction.format(0), /positive/);
  const strict = numberParser(positive);
  assert.equal(strict.parseText("5"), 5);
  assert.equal(strict.safeParse(0).success, false);
});

test("single-operator inputs work without generated query dispatch", () => {
  const state = shipmentInputs();
  state.filters.children = [shipmentFilters.late.$eq.value(true)];
  assert.deepEqual(shipmentQuery(state).where, { late: { $eq: true } });
});

test("disabled includes prune hidden invalid child controls; enabled includes validate them", () => {
  const state = accountInputs();
  state.orders.filters.children = [orderFilters.priority.$gte.read("invalid")];
  assert.equal("orders" in accountQuery(state).select, false);
  state.includeOrders = true;
  assert.throws(() => accountQuery(state), /number/);
});

test("literal callbacks still enforce nonempty selections and pagination budgets", () => {
  const state = accountInputs();
  state.columns.id = false;
  assert.throws(() => accountQuery(state), /select/);
  state.columns.id = true;
  state.limit = 101;
  assert.throws(() => accountQuery(state), /limit/);
  state.limit = 20;
  state.offset = -1;
  assert.throws(() => accountQuery(state), /offset/);
});

test("the literal API validates selected response values before returning typed rows", async (t) => {
  const response = (rows: unknown[]) =>
    new Response(
      JSON.stringify({
        rows,
        telemetry: {
          backend: "adira",
          serverMs: 1,
          mongoMs: 1,
          commands: 1,
          commandNames: {},
          callbacks: {},
          dataBytes: 10,
          memory: { rss: 1, heapUsed: 1 },
        },
      }),
      { status: 200 },
    );
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    response([{ name: "Acme", orders: [{ priority: 80 }] }]),
  );
  const request = {
    select: { name: true, orders: { select: { priority: true } } },
  } as const;
  const result = await getAccounts(request);
  assert.equal(result.rows[0].name, "Acme");
  assert.equal(result.rows[0].orders[0].priority, 80);
  fetch.mock.mockImplementation(async () =>
    response([{ name: "Acme", orders: [{ priority: "high" }] }]),
  );
  await assert.rejects(() => getAccounts(request), /number/);
});

test("direct literal requests omit conditional selections and preserve operand values", async (t) => {
  let sent: unknown;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    sent = JSON.parse(url.searchParams.get("query") ?? "null");
    return new Response(
      JSON.stringify({
        rows: [
          {
            name: "Acme",
            recentOrderAverage: null,
            manager: { name: "Agent" },
            orders: [{ number: "O-1" }],
          },
        ],
        telemetry: {
          backend: "adira",
          serverMs: 1,
          mongoMs: 1,
          commands: 1,
          commandNames: {},
          callbacks: {},
          dataBytes: 10,
          memory: { rss: 1, heapUsed: 1 },
        },
      }),
      { status: 200 },
    );
  });
  const result = await getAccounts({
    select: {
      name: true,
      riskScore: when(false, () => true),
      recentOrderAverage: when(true, () => true),
      manager: when(true, () => ({
        select: { name: true, region: when(false, () => true) },
      })),
      orders: when(true, () => ({
        select: { number: true, priority: when(false, () => true) },
      })),
    },
    where: {
      $and: [
        { hasRecentEscalation: { $eq: false } },
        { riskScore: { $gte: 0 } },
        { recentOrderAverage: { $eq: null } },
      ],
    },
    orderBy: undefined,
    page: undefined,
  });
  assert.deepEqual(sent, {
    select: {
      name: true,
      recentOrderAverage: true,
      manager: { select: { name: true } },
      orders: { select: { number: true } },
    },
    where: {
      $and: [
        { hasRecentEscalation: { $eq: false } },
        { riskScore: { $gte: 0 } },
        { recentOrderAverage: { $eq: null } },
      ],
    },
  });
  assert.deepEqual(result.rows, [
    {
      name: "Acme",
      recentOrderAverage: null,
      manager: { name: "Agent" },
      orders: [{ number: "O-1" }],
    },
  ]);
  assert.equal("riskScore" in result.rows[0], false);
  assert.equal("region" in (result.rows[0].manager ?? {}), false);
});
