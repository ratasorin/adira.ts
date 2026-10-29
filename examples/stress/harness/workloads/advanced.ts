import type { ReadQuery } from "@n/adira.core.ts";
import { AccountResource, OrderResource } from "../../contracts/resources";
import { AS_OF, DAY, SINCE } from "../../server/clock";

export const revenueQuality = {
  select: {
    id: true,
    name: true,
    recentOrderCount: true,
    recentOrderAverage: true,
    recentOrderMin: true,
    recentOrderMax: true,
    latestPaidOrderCents: true,
    marginBps: true,
    orders: {
      select: { id: true, netCents: true, priority: true },
      where: {
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
      orderBy: { netCents: "desc", id: "asc" },
      page: { offset: 1, limit: 2 },
    },
  },
  where: {
    $and: [
      { region: { $in: ["EU", "NA"] } },
      { $not: { tier: { $eq: "starter" } } },
      {
        $or: [
          {
            $and: [
              { recentOrderAverage: { $gte: 200_000 } },
              { recentOrderMax: { $gte: 400_000 } },
            ],
          },
          {
            $and: [
              { recentOrderCount: { $gte: 3 } },
              { $not: { recentOrderMin: { $gte: 150_000 } } },
            ],
          },
        ],
      },
    ],
  },
  orderBy: { recentOrderAverage: "desc", id: "asc" },
  page: { limit: 20 },
} as const satisfies ReadQuery<typeof AccountResource>;

export const fulfillment = {
  select: {
    id: true,
    number: true,
    priority: true,
    shortageUnits: true,
    fulfillmentScore: true,
    account: { select: { name: true } },
    items: {
      select: {
        quantity: true,
        marginCents: true,
        shortageUnits: true,
        product: {
          select: {
            sku: true,
            inventory: {
              select: { warehouse: true, available: true, stockStatus: true },
              where: {
                $or: [
                  { stockStatus: { $eq: "backorder" } },
                  {
                    $and: [
                      { available: { $lt: 30 } },
                      { $not: { stockStatus: { $eq: "healthy" } } },
                    ],
                  },
                ],
              },
              orderBy: { available: "asc", id: "asc" },
              page: { limit: 1 },
            },
          },
        },
      },
      where: {
        $or: [
          {
            $and: [
              { shortageUnits: { $gte: 1 } },
              { marginCents: { $gte: 10_000 } },
            ],
          },
          {
            $and: [
              { $not: { marginCents: { $gte: 20_000 } } },
              { quantity: { $gte: 3 } },
            ],
          },
        ],
      },
      orderBy: { shortageUnits: "desc", marginCents: "desc", id: "asc" },
      page: { limit: 2 },
    },
  },
  where: {
    $and: [
      { region: { $in: ["EU", "NA"] } },
      { placedAt: { $gte: AS_OF - 30 * DAY } },
      { $not: { status: { $eq: "cancelled" } } },
      {
        $or: [
          {
            $and: [{ shortageUnits: { $gte: 1 } }, { priority: { $gte: 55 } }],
          },
          { fulfillmentScore: { $gte: 90 } },
        ],
      },
    ],
  },
  orderBy: { fulfillmentScore: "desc", id: "asc" },
  page: { limit: 20 },
} as const satisfies ReadQuery<typeof OrderResource>;

export const nestedTriage = {
  select: {
    id: true,
    name: true,
    managerRevenueCents: true,
    manager: { select: { name: true } },
    orders: {
      select: {
        id: true,
        status: true,
        netCents: true,
        priority: true,
        items: {
          select: {
            quantity: true,
            marginCents: true,
            shortageUnits: true,
            product: {
              select: {
                sku: true,
                inventory: {
                  select: {
                    warehouse: true,
                    available: true,
                    stockStatus: true,
                  },
                  where: { $not: { stockStatus: { $eq: "healthy" } } },
                  orderBy: { available: "asc", id: "asc" },
                  page: { limit: 1 },
                },
              },
            },
          },
          where: {
            $and: [
              { marginCents: { $gte: 5_000 } },
              {
                $or: [
                  { quantity: { $gte: 3 } },
                  { shortageUnits: { $gte: 1 } },
                ],
              },
            ],
          },
          orderBy: { marginCents: "desc", id: "asc" },
          page: { limit: 2 },
        },
      },
      where: {
        $and: [
          { placedAt: { $gte: AS_OF - 30 * DAY } },
          { $not: { status: { $eq: "cancelled" } } },
          { $or: [{ priority: { $gte: 65 } }, { status: { $eq: "pending" } }] },
          { $not: { netCents: { $lt: 20_000 } } },
        ],
      },
      orderBy: { priority: "desc", netCents: "desc", id: "asc" },
      page: { offset: 1, limit: 3 },
    },
    tickets: {
      select: { subject: true, priority: true },
      where: {
        $and: [
          {
            $or: [{ status: { $eq: "open" } }, { status: { $eq: "pending" } }],
          },
          { $not: { priority: { $lt: 3 } } },
        ],
      },
      orderBy: { priority: "desc", openedAt: "asc", id: "asc" },
      page: { offset: 1, limit: 2 },
    },
  },
  where: { region: { $in: ["EU", "NA"] }, $not: { tier: { $eq: "starter" } } },
  orderBy: { id: "asc" },
  page: { offset: 1, limit: 12 },
} as const satisfies ReadQuery<typeof AccountResource>;

export const portfolioConcentration = {
  select: {
    id: true,
    name: true,
    netRevenueCents: true,
    managerRevenueCents: true,
    managerConcentrationBps: true,
    portfolioShareBps: true,
    manager: { select: { name: true } },
    tickets: {
      select: { subject: true, priority: true },
      where: {
        status: { $in: ["open", "pending"] },
        priority: { $gte: 4 },
        openedAt: { $gte: AS_OF - 30 * DAY },
      },
      orderBy: { priority: "desc", id: "asc" },
      page: { limit: 2 },
    },
  },
  where: {
    $and: [
      { region: { $in: ["EU", "NA"] } },
      { $not: { tier: { $eq: "starter" } } },
      {
        $or: [
          {
            $and: [
              { portfolioShareBps: { $gte: 200 } },
              { managerRevenueCents: { $gte: 500_000 } },
            ],
          },
          {
            $and: [
              { hasRecentEscalation: { $eq: true } },
              { $not: { managerConcentrationBps: { $lt: 2_000 } } },
            ],
          },
        ],
      },
    ],
  },
  orderBy: { portfolioShareBps: "desc", netRevenueCents: "desc", id: "asc" },
  page: { limit: 20 },
} as const satisfies ReadQuery<typeof AccountResource>;

export const advancedWorkloads = [
  {
    id: "revenueQuality",
    title: "Revenue quality",
    entity: "accounts",
    query: revenueQuality,
    description:
      "Count/avg/min/max and latest paid order over one complete relation; nested Boolean filters and an independently paged include.",
  },
  {
    id: "fulfillment",
    title: "Fulfillment constraints",
    entity: "orders",
    query: fulfillment,
    description:
      "Custom native line → stock lookup, prebuilt sum across those lines, JavaScript score, computed parent filters and filtered nested warehouses.",
  },
  {
    id: "nestedTriage",
    title: "Nested service triage",
    entity: "accounts",
    query: nestedTriage,
    description:
      "Independent offsets, computed filters and sorts at three relation levels; shared-manager aggregation and a separately filtered ticket page.",
  },
  {
    id: "portfolioConcentration",
    title: "Portfolio concentration",
    entity: "accounts",
    query: portfolioConcentration,
    description:
      "Programmatic batch deduplication, native two-level grouping, cross-account share, and an approved relation predicate inside a mixed Boolean tree.",
  },
] as const;
