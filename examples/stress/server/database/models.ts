import mongoose, { Schema, Types } from "mongoose";
export type Id = Types.ObjectId;
export interface Base {
  _id: Id;
  tenantId: Id;
  deletedAt: number | null;
}
export interface Tenant {
  _id: Id;
  name: string;
  code: string;
}
export interface Agent extends Base {
  name: string;
  email: string;
  region: string;
}
export interface Account extends Base {
  name: string;
  tier: string;
  region: string;
  managerId: Id;
  creditLimitCents: number;
  joinedAt: number;
}
export interface Product extends Base {
  name: string;
  sku: string;
  category: string;
  priceCents: number;
  costCents: number;
  active: boolean;
}
export interface Order extends Base {
  accountId: Id;
  managerId: Id;
  region: string;
  number: string;
  status: string;
  placedAt: number;
  totalCents: number;
  refundedCents: number;
}
export interface Line extends Base {
  orderId: Id;
  accountId: Id;
  productId: Id;
  placedAt: number;
  status: string;
  quantity: number;
  grossCents: number;
  costCents: number;
}
export interface Shipment extends Base {
  orderId: Id;
  accountId: Id;
  promisedAt: number;
  deliveredAt: number;
  late: boolean;
}
export interface Ticket extends Base {
  accountId: Id;
  agentId: Id;
  subject: string;
  status: string;
  priority: number;
  openedAt: number;
}
export interface Inventory extends Base {
  productId: Id;
  warehouse: string;
  onHand: number;
  reserved: number;
}
const base = {
  tenantId: { type: Schema.Types.ObjectId, required: true },
  deletedAt: { type: Number, default: null },
};
function model<T>(
  name: string,
  collection: string,
  fields: Record<string, unknown>,
  indexes: Record<string, 1 | -1>[],
) {
  const schema = new Schema<T>({ ...base, ...fields } as never, {
    versionKey: false,
    collection,
    autoIndex: false,
    autoCreate: false,
  });
  indexes.forEach((index) => schema.index(index));
  return mongoose.model<T>(name, schema);
}
export const Tenants = mongoose.model<Tenant>(
  "StressTenant",
  new Schema<Tenant>(
    { name: String, code: String },
    {
      collection: "stress_tenants",
      versionKey: false,
      autoCreate: false,
      autoIndex: false,
    },
  ),
);
export const Agents = model<Agent>(
  "StressAgent",
  "stress_agents",
  { name: String, email: String, region: String },
  [{ tenantId: 1, _id: 1 }],
);
export const Accounts = model<Account>(
  "StressAccount",
  "stress_accounts",
  {
    name: String,
    tier: String,
    region: String,
    managerId: Schema.Types.ObjectId,
    creditLimitCents: Number,
    joinedAt: Number,
  },
  [
    { tenantId: 1, deletedAt: 1, region: 1, name: 1 },
    { tenantId: 1, deletedAt: 1, tier: 1, name: 1 },
    { tenantId: 1, managerId: 1 },
  ],
);
export const Products = model<Product>(
  "StressProduct",
  "stress_products",
  {
    name: String,
    sku: String,
    category: String,
    priceCents: Number,
    costCents: Number,
    active: Boolean,
  },
  [{ tenantId: 1, deletedAt: 1, category: 1, active: 1, sku: 1 }],
);
export const Orders = model<Order>(
  "StressOrder",
  "stress_orders",
  {
    accountId: Schema.Types.ObjectId,
    managerId: Schema.Types.ObjectId,
    region: String,
    number: String,
    status: String,
    placedAt: Number,
    totalCents: Number,
    refundedCents: Number,
  },
  [
    { accountId: 1, tenantId: 1, placedAt: -1, _id: 1 },
    { tenantId: 1, deletedAt: 1, region: 1, placedAt: -1 },
    { tenantId: 1, managerId: 1, placedAt: -1 },
  ],
);
export const Lines = model<Line>(
  "StressLine",
  "stress_lines",
  {
    orderId: Schema.Types.ObjectId,
    accountId: Schema.Types.ObjectId,
    productId: Schema.Types.ObjectId,
    placedAt: Number,
    status: String,
    quantity: Number,
    grossCents: Number,
    costCents: Number,
  },
  [
    { orderId: 1, tenantId: 1, _id: 1 },
    { accountId: 1, tenantId: 1, placedAt: -1 },
    { productId: 1, tenantId: 1, placedAt: -1 },
  ],
);
export const Shipments = model<Shipment>(
  "StressShipment",
  "stress_shipments",
  {
    orderId: Schema.Types.ObjectId,
    accountId: Schema.Types.ObjectId,
    promisedAt: Number,
    deliveredAt: Number,
    late: Boolean,
  },
  [{ accountId: 1, tenantId: 1, deletedAt: 1, late: 1 }],
);
export const Tickets = model<Ticket>(
  "StressTicket",
  "stress_tickets",
  {
    accountId: Schema.Types.ObjectId,
    agentId: Schema.Types.ObjectId,
    subject: String,
    status: String,
    priority: Number,
    openedAt: Number,
  },
  [
    { accountId: 1, tenantId: 1, deletedAt: 1, status: 1 },
    { accountId: 1, tenantId: 1, openedAt: -1 },
  ],
);
export const Inventories = model<Inventory>(
  "StressInventory",
  "stress_inventory",
  {
    productId: Schema.Types.ObjectId,
    warehouse: String,
    onHand: Number,
    reserved: Number,
  },
  [{ productId: 1, tenantId: 1, deletedAt: 1, warehouse: 1 }],
);
export const models = [
  Tenants,
  Agents,
  Accounts,
  Products,
  Orders,
  Lines,
  Shipments,
  Tickets,
  Inventories,
];
export async function connect(uri: string) {
  await mongoose.connect(uri, {
    maxPoolSize: 32,
    minPoolSize: 0,
    monitorCommands: true,
    serverSelectionTimeoutMS: 5000,
  });
}
