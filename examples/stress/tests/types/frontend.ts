/** Checked by the frontend build without importing backend implementations or Mongoose. */
import type { ReadQuery } from "@n/adira.core.ts";
import type {
  AccountResource,
  OrderResource,
  ProductResource,
} from "../../contracts/resources";
import {
  getAccounts,
  getOrders,
  getOrdersBatched,
  getProducts,
} from "../../frontend/lib/api";

// These requests are authored by the frontend; benchmark presets are server-only.
const finances = {
  select: { netRevenueCents: true },
} as const satisfies ReadQuery<typeof AccountResource>;
const account360 = {
  select: {
    orders: {
      select: {
        items: {
          select: {
            product: { select: { sku: true } },
          },
        },
      },
    },
  },
} as const satisfies ReadQuery<typeof AccountResource>;
const replenishment = {
  select: { daysCover: true },
} as const satisfies ReadQuery<typeof ProductResource>;
const revenueQuality = {
  select: {
    recentOrderAverage: true,
    latestPaidOrderCents: true,
    recentOrderCount: true,
  },
} as const satisfies ReadQuery<typeof AccountResource>;
const fulfillment = {
  select: {
    items: {
      select: {
        shortageUnits: true,
        product: { select: { inventory: { select: { warehouse: true } } } },
      },
    },
  },
} as const satisfies ReadQuery<typeof OrderResource>;
const nestedTriage = {
  select: {
    orders: { select: { priority: true } },
    tickets: { select: { id: true } },
  },
} as const satisfies ReadQuery<typeof AccountResource>;
const portfolioConcentration = {
  select: { managerConcentrationBps: true },
} as const satisfies ReadQuery<typeof AccountResource>;
export async function inferredDashboardCards() {
  const revenue = await getAccounts(finances);
  const cents: number = revenue.rows[0].netRevenueCents;
  // @ts-expect-error Unselected fields are unavailable.
  revenue.rows[0].riskScore;
  // @ts-expect-error Amounts are not strings.
  const wrong: string = revenue.rows[0].netRevenueCents;
  const detailed = await getAccounts(account360);
  const sku: string | undefined =
    detailed.rows[0].orders[0].items[0].product?.sku;
  // @ts-expect-error Nested selection is enforced across include levels.
  detailed.rows[0].orders[0].items[0].product?.name;
  const stock = await getProducts(replenishment);
  const cover: number = stock.rows[0].daysCover;
  getAccounts({
    select: { name: true },
    // @ts-expect-error Numeric filter operands remain numeric.
    where: { riskScore: { $gte: "high" } },
  });
  return { cents, sku, cover, wrong };
}

export async function inferredAdvancedCards() {
  const quality = await getAccounts(revenueQuality);
  const average: number | null = quality.rows[0].recentOrderAverage;
  const latest: number | null = quality.rows[0].latestPaidOrderCents;
  const count: number = quality.rows[0].recentOrderCount;
  // @ts-expect-error Empty relations produce null, not an unconditionally present average.
  const nonNullable: number = quality.rows[0].recentOrderAverage;
  const queue = await getOrders(fulfillment);
  const batchedQueue = await getOrdersBatched(fulfillment);
  const sameContract: typeof queue = batchedQueue;
  const shortage: number = queue.rows[0].items[0].shortageUnits;
  const warehouse: string | undefined =
    queue.rows[0].items[0].product?.inventory[0].warehouse;
  // @ts-expect-error The include selects warehouse, not the inventory document ID.
  queue.rows[0].items[0].product?.inventory[0].id;
  const triage = await getAccounts(nestedTriage);
  const score: number = triage.rows[0].orders[0].priority;
  // @ts-expect-error A relation's filter/order fields do not become selected response fields.
  triage.rows[0].tickets[0].openedAt;
  const portfolio = await getAccounts(portfolioConcentration);
  const concentration: number = portfolio.rows[0].managerConcentrationBps;
  // @ts-expect-error Named predicates are filter-only; they are not response fields.
  portfolio.rows[0].hasRecentEscalation;
  return {
    average,
    latest,
    count,
    shortage,
    warehouse,
    score,
    concentration,
    nonNullable,
    sameContract,
  };
}

/** Deliberate compile-time probes of the current public API's boundaries. Never called. */
export function unsupportedFrontendRequests() {
  getAccounts({
    select: { id: true },
    where: {
      // @ts-expect-error Adira has no arbitrary relation quantifier syntax.
      orders: { $some: { priority: { $gte: 80 } } },
    },
  });
  getAccounts({
    select: {
      // @ts-expect-error Selecting the same relation under an arbitrary alias is unsupported.
      urgentOrders: { select: { id: true }, where: { priority: { $gte: 80 } } },
    },
  });
  getAccounts({
    select: {
      // @ts-expect-error Scalar computed fields have no frontend-supplied arguments.
      recentOrderAverage: { since: 123 },
    },
  });
  getAccounts({
    select: { id: true },
    where: {
      // @ts-expect-error Approved predicate operands have the declared type.
      hasRecentEscalation: { $eq: "yes" },
    },
  });
  getAccounts({
    select: { id: true },
    // @ts-expect-error Frontend aggregation/groupBy is intentionally unavailable.
    groupBy: ["region"],
  });
}
