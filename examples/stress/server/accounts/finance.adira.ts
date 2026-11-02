import { type PlanRow } from "@n/adira.backend.ts";
import { count } from "../../harness/telemetry";
import { finiteNumber } from "../read-context";
import { Cost, costOutput, loadCost } from "./cost.provider";
import { statisticsSource } from "./revenue-quality.adira";
import { loadRevenue, Revenue, revenueOutput } from "./revenue.provider";
import { marginBps } from "./rules";
import { accountNative } from "./source.adira";

const revenue = accountNative
  .related({
    requires: ["_id"],
    output: revenueOutput,
    resolveBatch: loadRevenue,
  })
  .one(Revenue);

const costs = accountNative
  .related({
    requires: ["_id"],
    output: costOutput,
    resolveBatch: loadCost,
  })
  .one(Cost);

export const financeSource = statisticsSource
  .load(
    "revenue",
    revenue.get({
      select: {
        grossRevenueCents: true,
        refundedCents: true,
        revenueOrderCount: true,
      },
    }),
  )
  .derive(
    "grossRevenueCents",
    ["revenue"],
    (row) => row.revenue?.grossRevenueCents ?? 0,
  )
  .derive(
    "refundedCents",
    ["revenue"],
    (row) => row.revenue?.refundedCents ?? 0,
  )
  .derive(
    "revenueOrderCount",
    ["revenue"],
    (row) => row.revenue?.revenueOrderCount ?? 0,
  )
  .derive("netRevenueCents", ["grossRevenueCents", "refundedCents"], (row) =>
    finiteNumber.parse(row.grossRevenueCents - row.refundedCents),
  )
  .load("cost", costs.get({ select: { costCents: true } }))
  .derive("costCents", ["cost"], (row) => row.cost?.costCents ?? 0);

export type FinanceIntermediate = PlanRow<typeof financeSource>;

export const marginSource = financeSource.derive(
  "marginBps",
  ["netRevenueCents", "costCents"],
  (r, c) => {
    count(c, "marginBps");
    return marginBps(r.netRevenueCents, r.costCents);
  },
);
