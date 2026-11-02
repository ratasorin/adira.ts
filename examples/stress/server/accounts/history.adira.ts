import { count } from "../../harness/telemetry";
import { SINCE } from "../clock";
import { portfolioSource } from "./portfolio.adira";
import { orders } from "./relations.adira";
import { volatility } from "./rules";

export const accountSource = portfolioSource
  .load(
    "history",
    orders.all({
      select: { netCents: true },
      where: { placedAt: { $gte: SINCE } },
    }),
  )
  .derive("orderVolatility", ["history"], (r, c) => {
    count(c, "orderVolatility");
    return volatility(r.history.map((o) => o.netCents));
  });
