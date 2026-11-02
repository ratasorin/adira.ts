import { readRecord } from "@n/adira.core.ts";
import { expect, test, type Page, type Response } from "@playwright/test";

const isRead = (response: Response) =>
  /\/api\/adira(?:-batched)?\/(?:accounts|orders|products)$/.test(
    new URL(response.url()).pathname,
  );

async function exchange(response: Response) {
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  const query: unknown = JSON.parse(
    new URL(response.url()).searchParams.get("query") ?? "null",
  );
  return {
    body: readRecord(body, "response"),
    query: readRecord(query, "query"),
    request: response.request(),
  };
}

async function change(page: Page, action: () => Promise<unknown>) {
  const pending = page.waitForResponse(isRead);
  await action();
  const result = await exchange(await pending);
  await expect(page.locator(".data-table")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  return result;
}

async function open(page: Page, resource = "accounts") {
  return change(page, () => page.goto(`/?resource=${resource}`));
}

async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  return change(page, () =>
    page.getByRole("button", { name, exact: true }).click(),
  );
}

test("starts with only visible columns and no implicit sorting", async ({
  page,
}) => {
  const { body, query } = await open(page);
  expect(query.select).toEqual({
    id: true,
    name: true,
    tier: true,
    region: true,
  });
  expect(query).not.toHaveProperty("orderBy");
  expect(query).not.toHaveProperty("where");
  expect(body).not.toHaveProperty("executor");
  expect(body.rows).toHaveLength(20);
  await expect(
    page.getByRole("button", { name: "Sort Name ascending", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("column visibility changes the server projection", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^Columns/ }).click();
  const removed = await change(page, () =>
    page.getByRole("checkbox", { name: "Show tier", exact: true }).click(),
  );
  expect(removed.query.select).not.toHaveProperty("tier");
  const added = await change(page, () =>
    page.getByRole("checkbox", { name: "Show riskScore", exact: true }).click(),
  );
  expect(added.query.select).toHaveProperty("riskScore", true);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: /^Tier/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("columnheader", { name: /^Risk Score/ }),
  ).toBeVisible();
});

test("sorting is set by the arrows and can be cleared", async ({ page }) => {
  await open(page);
  const ascending = await change(page, () =>
    page
      .getByRole("button", { name: "Sort Name ascending", exact: true })
      .click(),
  );
  expect(ascending.query.orderBy).toEqual({ name: "asc" });
  const descending = await change(page, () =>
    page
      .getByRole("button", { name: "Sort Name descending", exact: true })
      .click(),
  );
  expect(descending.query.orderBy).toEqual({ name: "desc" });
  const cleared = await change(page, () =>
    page.getByRole("button", { name: "Clear sort", exact: true }).click(),
  );
  expect(cleared.query).not.toHaveProperty("orderBy");
});

test("schema controls parse numeric filters and stop invalid requests", async ({
  page,
}) => {
  await open(page, "orders");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await change(page, () =>
    page.getByRole("button", { name: "Add filter", exact: true }).click(),
  );
  await change(page, () =>
    page
      .getByRole("combobox", { name: "Filter field", exact: true })
      .selectOption("priority"),
  );
  await change(page, () =>
    page
      .getByRole("combobox", { name: "Priority filter operator", exact: true })
      .selectOption("$gte"),
  );
  const value = page.getByRole("spinbutton", {
    name: "Priority filter value",
    exact: true,
  });
  const filtered = await change(page, () => value.fill("80"));
  expect(filtered.query.where).toEqual({ priority: { $gte: 80 } });
  let requests = 0;
  page.on("request", (request) => {
    if (/\/api\/adira\/orders\?/.test(request.url())) requests++;
  });
  await value.fill("");
  await expect(value).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("priority");
  await page.waitForTimeout(350);
  expect(requests).toBe(0);
  const recovered = await change(page, () => value.fill("0"));
  expect(recovered.query.where).toEqual({ priority: { $gte: 0 } });
});

test("boolean filters retain false and group controls retain structure", async ({
  page,
}) => {
  await open(page, "products");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await change(page, () =>
    page.getByRole("button", { name: "Add filter", exact: true }).click(),
  );
  await change(page, () =>
    page
      .getByRole("combobox", { name: "Filter field", exact: true })
      .selectOption("active"),
  );
  const filtered = await change(page, () =>
    page
      .getByRole("combobox", { name: "Active filter value", exact: true })
      .selectOption("false"),
  );
  expect(filtered.query.where).toEqual({ active: { $eq: false } });
  const negated = await change(page, () =>
    page.getByRole("checkbox", { name: "Not", exact: true }).click(),
  );
  expect(negated.query.where).toEqual({ $not: { active: { $eq: false } } });
  await page
    .getByRole("button", { name: "Add filter group", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Group matching", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove filter group", exact: true })
    .click();
  const cleared = await change(page, () =>
    page.getByRole("button", { name: "Clear filters", exact: true }).click(),
  );
  expect(cleared.query).not.toHaveProperty("where");
});

test("nested includes have independent projections and page sizes", async ({
  page,
}) => {
  await open(page, "orders");
  await page.getByRole("button", { name: /^Columns/ }).click();
  const included = await change(page, () =>
    page.getByRole("checkbox", { name: "Include items", exact: true }).click(),
  );
  const selection = readRecord(included.query.select, "select");
  expect(readRecord(selection.items, "items").page).toEqual({
    limit: 5,
    offset: 0,
  });
  const paged = await change(page, () =>
    page
      .getByRole("combobox", { name: "Items limit", exact: true })
      .selectOption("10"),
  );
  expect(
    readRecord(readRecord(paged.query.select, "select").items, "items").page,
  ).toEqual({ limit: 10, offset: 0 });
  const nested = await change(page, () =>
    page
      .getByRole("checkbox", { name: "Include items.product", exact: true })
      .click(),
  );
  const items = readRecord(
    readRecord(nested.query.select, "select").items,
    "items",
  );
  expect(readRecord(items.select, "item select")).toHaveProperty("product");
  const removed = await change(page, () =>
    page.getByRole("checkbox", { name: "Include items", exact: true }).click(),
  );
  expect(removed.query.select).not.toHaveProperty("items");
});

test("paging, workspace changes and resource navigation update requests", async ({
  page,
}) => {
  const initial = await open(page);
  const paged = await change(page, () =>
    page.getByRole("button", { name: "Next", exact: true }).click(),
  );
  expect(paged.query.page).toEqual({ limit: 20, offset: 20 });
  const tenant = await change(page, () =>
    page
      .getByRole("combobox", { name: "Tenant", exact: true })
      .selectOption("1"),
  );
  expect(tenant.request.headers()["x-tenant-index"]).toBe("1");
  expect(tenant.body.rows).not.toEqual(initial.body.rows);
  const orders = await navigate(page, "Orders");
  expect(new URL(orders.request.url()).pathname).toBe("/api/adira/orders");
  expect(orders.query).not.toHaveProperty("orderBy");
  const batched = await change(page, () =>
    page
      .getByRole("combobox", { name: "Implementation", exact: true })
      .selectOption("adira-batched"),
  );
  expect(new URL(batched.request.url()).pathname).toBe(
    "/api/adira-batched/orders",
  );
});

test("record details and query diagnostics open without page overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  const record = page.getByRole("button", {
    name: "Open record 1",
    exact: true,
  });
  await record.click();
  await expect(
    page.getByRole("tab", { name: "Details", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "JSON", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText('"id"');
  await page.keyboard.press("Escape");
  await expect(record).toBeFocused();
  await page.getByRole("button", { name: "Query", exact: true }).click();
  await expect(page.getByTestId("request-query")).toContainText('"select"');
  await page.getByRole("tab", { name: "Execution plan", exact: true }).click();
  await page.getByRole("button", { name: "Inspect plan", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText('"pipeline"');
  await page.getByRole("tab", { name: "Diagnostics", exact: true }).click();
  await page
    .getByRole("button", { name: "Run diagnostic", exact: true })
    .click();
  await expect(page.getByRole("tabpanel")).toContainText(
    '"candidateLimit": 400',
  );
  await page.keyboard.press("Escape");
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(errors).toEqual([]);
});
