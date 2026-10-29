import mongoose, { Types } from "mongoose";
import { regions, tiers } from "../server/accounts/rules";
import { AS_OF, DAY } from "../server/clock";
import {
  Accounts,
  Agents,
  connect,
  Inventories,
  Lines,
  models,
  Orders,
  Products,
  Shipments,
  Tenants,
  Tickets,
  type Account,
  type Line,
  type Order,
  type Product,
  type Shipment,
} from "../server/database/models";

export const profiles = {
  smoke: { tenants: 2, agents: 12, accounts: 40, products: 60, orders: 600 },
  medium: {
    tenants: 4,
    agents: 200,
    accounts: 1500,
    products: 2000,
    orders: 30_000,
  },
  large: {
    tenants: 4,
    agents: 600,
    accounts: 6000,
    products: 8000,
    orders: 150_000,
  },
} as const;
export type Profile = keyof typeof profiles;
export const oid = (kind: number, tenant: number, n: number) =>
  new Types.ObjectId(
    kind.toString(16).padStart(2, "0") +
      tenant.toString(16).padStart(4, "0") +
      n.toString(16).padStart(18, "0"),
  );
export function random(n: number): number {
  let x = (n + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}
const words = [
  "Northstar",
  "Meridian",
  "Atlas",
  "Harbor",
  "Summit",
  "Cobalt",
  "Juniper",
  "Orion",
];
function account(t: number, n: number, agents: number): Account {
  return {
    _id: oid(3, t, n),
    tenantId: oid(1, t, 0),
    deletedAt: n > 5 && n % 37 === 0 ? AS_OF - DAY : null,
    name: `${words[n % words.length]} ${["Industries", "Supply", "Labs", "Trading"][n % 4]} ${String(n).padStart(6, "0")}`,
    tier: tiers[n % 3],
    region: regions[n % 4],
    managerId: oid(2, t, n % agents),
    creditLimitCents: 50_000 + (random(n + 91) % 2_000_000),
    joinedAt: AS_OF - (n % 1000) * DAY,
  };
}
function product(t: number, n: number): Product {
  const priceCents = 500 + (random(n + 173) % 50_000);
  return {
    _id: oid(4, t, n),
    tenantId: oid(1, t, 0),
    deletedAt: n % 53 === 52 ? AS_OF - DAY : null,
    name: `${["Sensor", "Controller", "Module", "Gateway", "Cable"][n % 5]} ${n}`,
    sku: `SKU-${String(n).padStart(7, "0")}`,
    category: [
      "hardware",
      "network",
      "components",
      "accessories",
      "industrial",
    ][n % 5],
    priceCents,
    costCents: Math.round(priceCents * (0.35 + (n % 40) / 100)),
    active: n % 11 !== 10,
  };
}
async function batches<T>(
  count: number,
  build: (n: number) => T,
  insert: (rows: T[]) => Promise<unknown>,
) {
  for (let start = 0; start < count; start += 1000)
    await insert(
      Array.from({ length: Math.min(1000, count - start) }, (_, i) =>
        build(start + i),
      ),
    );
}
export async function seed(
  profile: Profile,
  reset = false,
  log: (message: string) => void = console.log,
) {
  const db = mongoose.connection.db!;
  if (!/^adira_stress(?:_|$)/.test(db.databaseName))
    throw new Error(
      "Seed only accepts database names beginning adira_stress; other databases are protected",
    );
  const config = profiles[profile];
  const existing = await Promise.all(
    models.map((model) => model.estimatedDocumentCount()),
  );
  if (existing.some(Boolean) && !reset)
    throw new Error(
      "Stress data already exists. Use --reset to replace only the named stress collections",
    );
  if (reset) {
    for (const model of models) await model.collection.deleteMany({});
    await db.collection("stress_metadata").deleteMany({});
  }
  const started = performance.now();
  for (let t = 0; t < config.tenants; t++) {
    const tenantId = oid(1, t, 0);
    await Tenants.collection.insertOne({
      _id: tenantId,
      name: [
        "Northstar Commerce",
        "Meridian Operations",
        "Atlas Wholesale",
        "Harbor Supply",
      ][t % 4],
      code: `tenant-${t}`,
    });
    await batches(
      config.agents,
      (n) => ({
        _id: oid(2, t, n),
        tenantId,
        deletedAt: null,
        name: `${["Avery", "Jordan", "Morgan", "Riley"][n % 4]} ${["Chen", "Silva", "Patel", "Ionescu"][n % 4]} ${n}`,
        email: `agent${n}@tenant${t}.example`,
        region: regions[n % 4],
      }),
      (rows) => Agents.collection.insertMany(rows),
    );
    await batches(
      config.accounts,
      (n) => account(t, n, config.agents),
      (rows) => Accounts.collection.insertMany(rows),
    );
    await batches(
      config.products,
      (n) => product(t, n),
      (rows) => Products.collection.insertMany(rows),
    );
    await batches(
      config.products * 2,
      (n) => ({
        _id: oid(9, t, n),
        tenantId,
        deletedAt: null,
        productId: oid(4, t, Math.floor(n / 2)),
        warehouse: ["AMS", "JFK", "SIN", "LAX"][n % 4],
        onHand: random(n + 11) % 250,
        reserved: random(n + 23) % 150,
      }),
      (rows) => Inventories.collection.insertMany(rows),
    );
    await batches(
      config.accounts * 6,
      (n) => ({
        _id: oid(8, t, n),
        tenantId,
        deletedAt: n % 41 === 40 ? AS_OF - DAY : null,
        accountId: oid(3, t, Math.floor(n / 6)),
        agentId: oid(2, t, n % config.agents),
        subject: [
          "Delivery inquiry",
          "Invoice adjustment",
          "Damaged item",
          "Stock availability",
        ][n % 4],
        status: ["open", "pending", "closed", "resolved"][random(n + 31) % 4],
        priority: 1 + (random(n + 77) % 5),
        openedAt: AS_OF - (random(n + 98) % 180) * DAY,
      }),
      (rows) => Tickets.collection.insertMany(rows),
    );
    for (let start = 0; start < config.orders; start += 500) {
      const orders: Order[] = [];
      const lines: Line[] = [];
      const shipments: Shipment[] = [];
      for (let n = start; n < Math.min(start + 500, config.orders); n++) {
        const r = random(n + t * 900001),
          a = r % 100 < 35 ? r % 5 : 5 + (r % Math.max(1, config.accounts - 5));
        const acct = account(t, a, config.agents),
          orderId = oid(5, t, n),
          placedAt = AS_OF - (random(n + 410) % 365) * DAY;
        const status = [
          "paid",
          "paid",
          "paid",
          "paid",
          "shipped",
          "shipped",
          "shipped",
          "shipped",
          "pending",
          "cancelled",
        ][random(n + 97) % 10];
        const deletedAt = n % 101 === 100 ? AS_OF - DAY : null;
        let totalCents = 0;
        for (let j = 0; j < 4; j++) {
          const p = random(n * 4 + j + 601) % config.products,
            prod = product(t, p),
            quantity = 1 + (random(n * 4 + j + 881) % 5);
          const grossCents = quantity * prod.priceCents;
          totalCents += grossCents;
          lines.push({
            _id: oid(6, t, n * 4 + j),
            tenantId,
            deletedAt,
            orderId,
            accountId: acct._id,
            productId: prod._id,
            placedAt,
            status,
            quantity,
            grossCents,
            costCents: quantity * prod.costCents,
          });
        }
        orders.push({
          _id: orderId,
          tenantId,
          deletedAt,
          accountId: acct._id,
          managerId: acct.managerId,
          region: acct.region,
          number: `ORD-${t}-${String(n).padStart(7, "0")}`,
          status,
          placedAt,
          totalCents,
          refundedCents:
            status === "shipped" && r % 7 === 0
              ? Math.round(totalCents / 4)
              : 0,
        });
        if (n % 4 !== 3) {
          const promisedAt = placedAt + 3 * DAY,
            deliveredAt = promisedAt + ((r % 5) - 2) * DAY;
          shipments.push({
            _id: oid(7, t, n),
            tenantId,
            deletedAt,
            orderId,
            accountId: acct._id,
            promisedAt,
            deliveredAt,
            late: deliveredAt > promisedAt,
          });
        }
      }
      await Promise.all([
        Orders.collection.insertMany(orders),
        Lines.collection.insertMany(lines),
        shipments.length
          ? Shipments.collection.insertMany(shipments)
          : Promise.resolve(),
      ]);
    }
    log(`Seeded tenant ${t + 1}/${config.tenants}`);
  }
  for (const model of models) await model.createIndexes();
  const counts = Object.fromEntries(
    await Promise.all(
      models.map(async (model) => [
        model.collection.name,
        await model.countDocuments({}),
      ]),
    ),
  );
  const metadata = {
    profile,
    config,
    counts,
    asOf: AS_OF,
    since: AS_OF - 90 * DAY,
    seededAt: new Date().toISOString(),
    seedMs: performance.now() - started,
    distribution:
      "35% of orders belong to five whale accounts per tenant; remaining orders are uniform; four lines/order",
  };
  await db
    .collection("stress_metadata")
    .replaceOne(
      { _id: "dataset" as never },
      { _id: "dataset" as never, ...metadata },
      { upsert: true },
    );
  log(JSON.stringify(metadata, null, 2));
  return metadata;
}
export function option(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? (fallback ?? "") : (process.argv[index + 1] ?? "");
}
if (require.main === module)
  (async () => {
    const profile = option("profile", "medium") as Profile;
    if (!Object.hasOwn(profiles, profile)) throw new Error("Unknown profile");
    await connect(
      option(
        "uri",
        process.env.STRESS_MONGO_URI ??
          "mongodb://127.0.0.1:27017/adira_stress",
      ),
    );
    try {
      await seed(profile, process.argv.includes("--reset"));
    } finally {
      await mongoose.disconnect();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
