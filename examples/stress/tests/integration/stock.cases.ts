import mongoose from "mongoose";
import assert from "node:assert/strict";
import { test } from "node:test";
import { oid } from "../../harness/seed";
import { AS_OF, SINCE } from "../../server/clock";
import {
  Inventories,
  Lines,
  Orders,
  Products,
} from "../../server/database/models";
import { customRead, host, selectedMetrics } from "./fixtures";

test("custom native stock producers, prebuilt sums and callbacks preserve parent association and tenant scope", async () => {
  const tenantId = oid(1, 0, 0),
    orderId = new mongoose.Types.ObjectId(),
    productId = new mongoose.Types.ObjectId();
  const lineIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];
  const inventoryIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];
  try {
    await Products.collection.insertOne({
      _id: productId,
      tenantId,
      deletedAt: null,
      name: "Stock fixture",
      sku: "FIXTURE",
      category: "hardware",
      priceCents: 100,
      costCents: 10,
      active: true,
    });
    await Orders.collection.insertOne({
      _id: orderId,
      tenantId,
      deletedAt: null,
      accountId: oid(3, 0, 0),
      managerId: oid(2, 0, 0),
      region: "EU",
      number: "Stock fixture",
      status: "pending",
      placedAt: AS_OF - 1,
      totalCents: 10_000,
      refundedCents: 0,
    });
    await Lines.collection.insertMany(
      lineIds.map((_id, i) => ({
        _id,
        tenantId,
        deletedAt: null,
        orderId,
        productId,
        accountId: oid(3, 0, 0),
        placedAt: AS_OF - 1,
        status: "pending",
        quantity: [3, 7][i],
        grossCents: 1000,
        costCents: 100,
      })),
    );
    await Inventories.collection.insertMany([
      {
        _id: inventoryIds[0],
        tenantId,
        deletedAt: null,
        productId,
        warehouse: "AMS",
        onHand: 6,
        reserved: 1,
      },
      {
        _id: inventoryIds[1],
        tenantId: oid(1, 1, 0),
        deletedAt: null,
        productId,
        warehouse: "LEAK",
        onHand: 99999,
        reserved: 0,
      },
      {
        _id: inventoryIds[2],
        tenantId,
        deletedAt: AS_OF,
        productId,
        warehouse: "DELETED",
        onHand: 99999,
        reserved: 0,
      },
    ]);
    const query = {
      select: {
        shortageUnits: true,
        fulfillmentScore: true,
        items: {
          select: {
            quantity: true,
            shortageUnits: true,
            product: {
              select: {
                sku: true,
                inventory: {
                  select: { available: true, stockStatus: true },
                  where: { $not: { stockStatus: { $eq: "healthy" } } },
                },
              },
            },
          },
          where: { shortageUnits: { $gte: 1 } },
          page: { limit: 1 },
        },
      },
      where: { id: { $eq: String(orderId) } },
    };
    const result = await customRead("orders", query);
    const batched = await customRead("orders", query, "adira-batched");
    assert.deepEqual(batched.rows, result.rows);
    assert.equal(result.rows[0].shortageUnits, 2);
    assert.deepEqual(result.rows[0].items, [
      {
        quantity: 7,
        shortageUnits: 2,
        product: {
          sku: "FIXTURE",
          inventory: [{ available: 5, stockStatus: "low" }],
        },
      },
    ]);
    await Inventories.collection.deleteOne({ _id: inventoryIds[0] });
    const noStock = await customRead("orders", {
      select: { shortageUnits: true },
      where: { id: { $eq: String(orderId) } },
    });
    assert.equal(
      noStock.rows[0].shortageUnits,
      10,
      "Missing inventory is zero available stock",
    );
    const noStockBatched = await customRead(
      "orders",
      {
        select: { shortageUnits: true },
        where: { id: { $eq: String(orderId) } },
      },
      "adira-batched",
    );
    assert.deepEqual(noStockBatched.rows, noStock.rows);
  } finally {
    await Lines.collection.deleteMany({ _id: { $in: lineIds } });
    await Inventories.collection.deleteMany({ _id: { $in: inventoryIds } });
    await Orders.collection.deleteOne({ _id: orderId });
    await Products.collection.deleteOne({ _id: productId });
  }
});

test("stock totals and warehouse counts share a batch while unrelated product demands stay pruned", async () => {
  const base = {
    where: { category: { $eq: "hardware" }, active: { $eq: true } },
    orderBy: { id: "asc" },
    page: { limit: 2 },
  };
  const get = async (select: object) => {
    const response = await fetch(
      host!.url +
        `/api/adira/products?query=${encodeURIComponent(JSON.stringify({ ...base, select }))}`,
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const plain = await get({ sku: true });
  assert.deepEqual(plain.telemetry.callbacks, {});
  assert.equal(plain.telemetry.commands, 1);
  const stock = await get({ sku: true, available: true, warehouseCount: true });
  assert.equal(stock.telemetry.callbacks.stockBatch, 1);
  assert.equal(stock.telemetry.callbacks.stockParents, 2);
  assert.equal(
    stock.telemetry.commands,
    2,
    "stock amounts and warehouse count share one aggregate",
  );
  const sales = await get({ sku: true, unitsSold: true });
  assert.equal(sales.telemetry.callbacks.stockBatch, undefined);
});

test("shared stock grouping deduplicates foreign arrays and excludes malformed/cross-tenant policy values", async () => {
  const parents = [oid(4, 0, 0), oid(4, 0, 1)];
  const select = { id: true, available: true, warehouseCount: true };
  const before = await selectedMetrics("products", parents.map(String), select);
  const base = {
    tenantId: oid(1, 0, 0),
    deletedAt: null,
    productId: parents[0],
    warehouse: "probe",
    onHand: 1_000_000,
    reserved: 0,
  };
  const rows = [
    {
      ...base,
      _id: new mongoose.Types.ObjectId(),
      productId: [parents[0], parents[1], parents[0]],
      onHand: 8,
      reserved: 3,
    },
    ...[
      { tenantId: [base.tenantId] },
      { deletedAt: [null] },
      { tenantId: oid(1, 1, 0) },
      { deletedAt: SINCE },
    ].map((fields) => ({
      ...base,
      ...fields,
      _id: new mongoose.Types.ObjectId(),
    })),
  ];
  try {
    await Inventories.collection.insertMany(rows as never[]);
    const after = await selectedMetrics(
      "products",
      parents.map(String),
      select,
    );
    for (const [index, row] of after.entries()) {
      assert.equal(row.id, before[index].id);
      assert.equal(row.available, before[index].available + 5);
      assert.equal(row.warehouseCount, before[index].warehouseCount + 1);
    }
  } finally {
    await Inventories.collection.deleteMany({
      _id: { $in: rows.map((row) => row._id) },
    });
  }
});
