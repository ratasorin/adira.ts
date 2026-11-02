import type { ReadQuery } from "@n/adira.core.ts";
import {
  AccountResource,
  OrderResource,
  ProductResource,
} from "../../contracts/resources";
import { AS_OF, DAY, SINCE } from "../../server/clock";
import { advancedWorkloads } from "./advanced";

export const directory = {
  select: { id: true, name: true, tier: true, region: true },
  where: {
    $and: [
      { region: { $in: ["EU", "NA"] } },
      { $not: { tier: { $eq: "starter" } } },
    ],
  },
  orderBy: { name: "asc", id: "asc" },
  page: { limit: 40 },
} as const satisfies ReadQuery<typeof AccountResource>;
export const finances = {
  select: {
    id: true,
    name: true,
    tier: true,
    netRevenueCents: true,
    revenueOrderCount: true,
    marginBps: true,
  },
  where: {
    $and: [
      { region: { $in: ["EU", "NA"] } },
      { tier: { $in: ["growth", "enterprise"] } },
      { netRevenueCents: { $gte: 10_000 } },
    ],
  },
  orderBy: { netRevenueCents: "desc", id: "asc" },
  page: { limit: 30 },
} as const satisfies ReadQuery<typeof AccountResource>;
export const risk = {
  select: {
    id: true,
    name: true,
    region: true,
    netRevenueCents: true,
    openTicketCount: true,
    lateShipmentCount: true,
    riskScore: true,
    riskBand: true,
  },
  where: {
    $and: [
      { region: { $in: ["EU", "NA"] } },
      { $or: [{ riskScore: { $gte: 45 } }, { openTicketCount: { $gte: 4 } }] },
      { $not: { tier: { $eq: "starter" } } },
    ],
  },
  orderBy: { riskScore: "desc", id: "asc" },
  page: { limit: 25 },
} as const satisfies ReadQuery<typeof AccountResource>;
export const account360 = {
  select: {
    id: true,
    name: true,
    netRevenueCents: true,
    riskScore: true,
    managerRevenueCents: true,
    manager: { select: { name: true } },
    orders: {
      select: {
        id: true,
        number: true,
        netCents: true,
        priority: true,
        items: {
          select: {
            quantity: true,
            marginCents: true,
            product: {
              select: {
                sku: true,
                inventory: {
                  select: {
                    warehouse: true,
                    available: true,
                    stockStatus: true,
                  },
                  orderBy: { warehouse: "asc", id: "asc" },
                  page: { limit: 2 },
                },
              },
            },
          },
          orderBy: { id: "asc" },
          page: { limit: 2 },
        },
      },
      orderBy: { placedAt: "desc", id: "asc" },
      page: { limit: 2 },
    },
    tickets: {
      select: { subject: true, priority: true },
      where: { status: { $in: ["open", "pending"] } },
      orderBy: { priority: "desc", id: "asc" },
      page: { limit: 2 },
    },
  },
  where: { region: { $eq: "EU" } },
  orderBy: { name: "asc", id: "asc" },
  page: { limit: 12 },
} as const satisfies ReadQuery<typeof AccountResource>;
export const orderOps = {
  select: {
    id: true,
    number: true,
    status: true,
    netCents: true,
    priority: true,
    account: { select: { name: true, region: true } },
    items: {
      select: {
        quantity: true,
        marginCents: true,
        product: {
          select: {
            sku: true,
            inventory: {
              select: { warehouse: true, available: true, stockStatus: true },
              orderBy: { warehouse: "asc", id: "asc" },
              page: { limit: 2 },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      page: { limit: 2 },
    },
  },
  where: {
    $and: [
      { region: { $eq: "EU" } },
      { placedAt: { $gte: AS_OF - 30 * DAY } },
      { $or: [{ status: { $eq: "pending" } }, { priority: { $gte: 65 } }] },
      { $not: { status: { $eq: "cancelled" } } },
    ],
  },
  orderBy: { priority: "desc", id: "asc" },
  page: { limit: 20 },
} as const satisfies ReadQuery<typeof OrderResource>;
export const replenishment = {
  select: {
    id: true,
    name: true,
    sku: true,
    available: true,
    unitsSold: true,
    warehouseCount: true,
    daysCover: true,
    inventory: {
      select: {
        warehouse: true,
        onHand: true,
        reserved: true,
        stockStatus: true,
      },
      orderBy: { warehouse: "asc", id: "asc" },
      page: { limit: 2 },
    },
  },
  where: {
    $and: [
      { category: { $eq: "hardware" } },
      { active: { $eq: true } },
      { $or: [{ daysCover: { $lt: 60 } }, { available: { $lt: 0 } }] },
    ],
  },
  orderBy: { daysCover: "asc", id: "asc" },
  page: { limit: 25 },
} as const satisfies ReadQuery<typeof ProductResource>;
export const history = {
  select: { id: true, name: true, orderVolatility: true },
  where: { id: { $eq: "030000000000000000000000" } },
  page: { limit: 1 },
} as const;
// The budget diagnostic constructs this query using the selected tenant's whale account.
export const workloads = [
  {
    id: "directory",
    title: "Account directory",
    entity: "accounts",
    query: directory,
    description:
      "Native filters and pagination; expensive fields should be pruned.",
  },
  {
    id: "finances",
    title: "Revenue & margin",
    entity: "accounts",
    query: finances,
    description:
      "Bulk revenue and cost aggregates through typed batch resolvers; JavaScript margin after pagination.",
  },
  {
    id: "risk",
    title: "Service risk",
    entity: "accounts",
    query: risk,
    description:
      "Nested AND/OR/NOT; bulk finance, prebuilt counts, resolveBatch exposure and JavaScript filtering/sorting.",
  },
  {
    id: "account360",
    title: "Account 360°",
    entity: "accounts",
    query: account360,
    description:
      "Paged parents; nested orders → items → product → inventory; custom shared manager aggregates.",
  },
  {
    id: "orderOps",
    title: "Order operations",
    entity: "orders",
    query: orderOps,
    description:
      "Mixed native/JavaScript predicates; account include and three nested relation levels.",
  },
  {
    id: "replenishment",
    title: "Replenishment",
    entity: "products",
    query: replenishment,
    description:
      "Shared stock totals and warehouse count, prebuilt sales sum, JavaScript days of cover and nested warehouses.",
  },
  ...advancedWorkloads,
] as const;
export type WorkloadId = (typeof workloads)[number]["id"];
export const datasetWindow = { asOf: AS_OF, since: SINCE };
