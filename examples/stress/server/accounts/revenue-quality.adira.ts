import { SINCE } from "../clock";
import { orders } from "./relations.adira";
import { accountNative } from "./source.adira";

export const statisticsSource = accountNative
  .toApp({ batchSize: 128, concurrency: 8 })
  .load(
    "recentOrderCount",
    orders.count({
      where: {
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
    }),
  )
  .load(
    "recentOrderAverage",
    orders.avg({
      field: "netCents",
      where: {
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
    }),
  )
  .load(
    "recentOrderMin",
    orders.min({
      field: "netCents",
      where: {
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
    }),
  )
  .load(
    "recentOrderMax",
    orders.max({
      field: "netCents",
      where: {
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
    }),
  )
  .load(
    "latestPaidOrder",
    orders.first({
      select: { netCents: true },
      where: {
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
      orderBy: { placedAt: "desc", id: "asc" },
    }),
  )
  .derive(
    "latestPaidOrderCents",
    ["latestPaidOrder"],
    (row) => row.latestPaidOrder?.netCents ?? null,
  );
