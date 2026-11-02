import { AS_OF, DAY, SINCE } from "../clock";
import { type Order } from "../database/models";

export const statuses = ["pending", "paid", "shipped", "cancelled"] as const;

export const money = (value: number) => Math.round(value);

export const priority = (total: number, status: string, age: number) =>
  Math.min(
    100,
    Math.round(
      Math.log2(1 + total / 1000) * 5 +
        (status === "pending" ? 25 : 0) +
        Math.min(30, age * 2),
    ),
  );

export const fulfillmentScore = (priority: number, shortage: number) =>
  priority + Math.min(50, shortage * 8);

export const paidWindow = {
  placedAt: { $gte: SINCE },
  status: { $in: ["paid", "shipped"] },
};

export type FinancialOrder = Pick<
  Order,
  "_id" | "totalCents" | "refundedCents" | "status" | "placedAt"
>;

export const net = (row: Pick<Order, "totalCents" | "refundedCents">) =>
  row.totalCents - row.refundedCents;

export const orderPriority = (
  row: Pick<Order, "totalCents" | "status" | "placedAt">,
) => priority(row.totalCents, row.status, (AS_OF - row.placedAt) / DAY);
