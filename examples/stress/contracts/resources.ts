import { defaultReadLimits, defineResource, field } from "@n/adira.core.ts";
export const readLimits = {
  ...defaultReadLimits,
  defaultLimit: 40,
  maxLimit: 100,
};
const id = () => field.string().filterable("$eq").orderable();
const number = () =>
  field.number().filterable("$eq", "$gte", "$lt").orderable();
const text = () =>
  field.string().filterable("$eq", "$in", "$startsWith").orderable();
export const AgentResource = defineResource({
  id: id(),
  name: text(),
  region: text(),
});
export const AccountMini = defineResource({
  id: id(),
  name: text(),
  region: text(),
});
export const InventoryResource = defineResource({
  id: id(),
  warehouse: text(),
  onHand: number(),
  reserved: number(),
  available: number(),
  stockStatus: text(),
});
export const ProductMini = defineResource({
  id: id(),
  name: text(),
  sku: text(),
  inventory: field.many(InventoryResource),
});
export const LineResource = defineResource({
  id: id(),
  quantity: number(),
  grossCents: number(),
  marginCents: number(),
  shortageUnits: number(),
  placedAt: number(),
  status: text(),
  product: field.one(ProductMini).nullable(),
});
export const OrderResource = defineResource({
  id: id(),
  number: text(),
  status: text(),
  region: text(),
  placedAt: number(),
  totalCents: number(),
  netCents: number(),
  priority: number(),
  shortageUnits: number(),
  fulfillmentScore: number(),
  account: field.one(AccountMini).nullable(),
  items: field.many(LineResource),
});
export const TicketResource = defineResource({
  id: id(),
  subject: text(),
  status: text(),
  priority: number(),
  openedAt: number(),
});
export const ShipmentResource = defineResource({
  id: id(),
  late: field.boolean().filterable("$eq"),
});
export const AccountResource = defineResource(
  {
    id: id(),
    name: text(),
    tier: text(),
    region: text(),
    creditLimitCents: number(),
    grossRevenueCents: number(),
    netRevenueCents: number(),
    costCents: number(),
    revenueOrderCount: number(),
    marginBps: number(),
    openTicketCount: number(),
    lateShipmentCount: number(),
    riskScore: number(),
    riskBand: text(),
    managerRevenueCents: number(),
    managerConcentrationBps: number(),
    portfolioShareBps: number(),
    recentOrderCount: number(),
    recentOrderAverage: number().nullable(),
    recentOrderMin: number().nullable(),
    recentOrderMax: number().nullable(),
    latestPaidOrderCents: number().nullable(),
    orderVolatility: number(),
    manager: field.one(AgentResource).nullable(),
    orders: field.many(OrderResource),
    tickets: field.many(TicketResource),
  },
  {
    predicates: { hasRecentEscalation: field.boolean().filterable("$eq") },
  },
);
export const ProductResource = defineResource({
  id: id(),
  name: text(),
  sku: text(),
  category: text(),
  active: field.boolean().filterable("$eq"),
  available: number(),
  unitsSold: number(),
  warehouseCount: number(),
  daysCover: number(),
  inventory: field.many(InventoryResource),
});
export type Entity = "accounts" | "orders" | "products";
