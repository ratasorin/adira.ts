import { financeSource } from "./finance.adira";
import {
  Portfolio,
  loadPortfolio,
  portfolioOutput,
} from "./portfolio.provider";
import { riskSource } from "./risk.adira";
import { shareBps } from "./rules";

const portfolio = financeSource
  .related({
    requires: ["managerId"],
    output: portfolioOutput,
    resolveBatch: loadPortfolio,
  })
  .one(Portfolio);

export const portfolioSource = riskSource
  .load(
    "portfolio",
    portfolio.get({
      select: { revenueCents: true, largestAccountCents: true },
    }),
  )
  .derive(
    "managerRevenueCents",
    ["portfolio"],
    (r) => r.portfolio?.revenueCents ?? 0,
  )
  .derive("managerConcentrationBps", ["portfolio"], (row) =>
    shareBps(
      row.portfolio?.largestAccountCents ?? 0,
      row.portfolio?.revenueCents ?? 0,
    ),
  )
  .derive(
    "portfolioShareBps",
    ["netRevenueCents", "managerRevenueCents"],
    (row) => shareBps(row.netRevenueCents, row.managerRevenueCents),
  );
