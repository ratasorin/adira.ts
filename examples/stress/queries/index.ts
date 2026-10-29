import { creditLimits, directory, managers, revenue } from "./accounts";
import { items, netAmounts, priorities, statuses } from "./orders";
import { active, availableStock, replenishment, warehouses } from "./products";

export const comparisons = [
  directory,
  creditLimits,
  revenue,
  managers,
  statuses,
  items,
  priorities,
  netAmounts,
  active,
  warehouses,
  availableStock,
  replenishment,
];
