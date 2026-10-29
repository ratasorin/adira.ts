import mongoose from "mongoose";
import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from "../../harness/benchmarks/run";
import { oid } from "../../harness/seed";
import { workloads } from "../../harness/workloads";
import { SINCE } from "../../server/clock";
import { Inventories, Lines, Orders } from "../../server/database/models";
import { host, selectedMetrics } from "./fixtures";

test("lightweight selection prunes finance, service and JavaScript work", async () => {
  const result = await request(host!.url, "adira", workloads[0]);
  assert.deepEqual(result.body.telemetry?.callbacks, {});
  assert.equal(result.body.telemetry?.commands, 1);
  const response = await fetch(
    host!.url +
      `/api/adira/plan/accounts?query=${encodeURIComponent(JSON.stringify(workloads[0].query))}`,
  );
  const body = await response.json();
  assert.equal(JSON.stringify(body.pipeline).includes("$lookup"), false);
});

test("bulk revenue consumers skip costs and margin loads costs only for the selected page", async () => {
  for (const view of ["risk", "account360"]) {
    const result = await request(
      host!.url,
      "adira",
      workloads.find((w) => w.id === view)!,
    );
    assert.equal(result.status, 200);
    assert.ok(result.body.telemetry!.callbacks.revenueBatch > 0);
    assert.equal(result.body.telemetry!.callbacks.costBatch, undefined);
    if (view === "account360")
      assert.equal(
        result.body.telemetry!.callbacks.revenueParents,
        result.body.rows!.length,
      );
  }
  const workload = workloads.find((entry) => entry.id === "finances")!;
  const query = { ...workload.query, page: { limit: 3 } };
  const encoded = encodeURIComponent(JSON.stringify(query));
  const response = await fetch(
    host!.url + `/api/adira/accounts?query=${encoded}`,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.rows.length, 3);
  assert.equal(body.telemetry.callbacks.costParents, 3);
  assert.equal(body.telemetry.callbacks.marginBps, 3);
  assert.ok(body.telemetry.callbacks.revenueParents > 3);
  const plan = await (
    await fetch(host!.url + `/api/adira/plan/accounts?query=${encoded}`)
  ).json();
  assert.ok(
    plan.application.indexOf("load cost") >
      plan.application.indexOf("paginate"),
  );
  assert.ok(!JSON.stringify(plan.pipeline).includes("$lookup"));
});

test("bulk finance preserves shared foreign-array membership and exact tenant/soft-delete policies", async () => {
  const parents = [oid(3, 0, 0), oid(3, 0, 1)];
  const select = {
    id: true,
    grossRevenueCents: true,
    netRevenueCents: true,
    revenueOrderCount: true,
    costCents: true,
  };
  const before = await selectedMetrics("accounts", parents.map(String), select);
  const base = {
    tenantId: oid(1, 0, 0),
    deletedAt: null,
    accountId: parents[0],
    placedAt: SINCE + 1,
    status: "paid",
  };
  const excluded = [
    { tenantId: [base.tenantId] },
    { deletedAt: [null] },
    { tenantId: oid(1, 1, 0) },
    { deletedAt: SINCE },
  ];
  const orders = [
    {
      ...base,
      _id: new mongoose.Types.ObjectId(),
      accountId: [parents[0], parents[1], parents[0]],
      totalCents: 100,
      refundedCents: 20,
    },
    ...excluded.map((fields) => ({
      ...base,
      ...fields,
      _id: new mongoose.Types.ObjectId(),
      totalCents: 1_000_000,
      refundedCents: 0,
    })),
  ];
  const lines = [
    {
      ...base,
      _id: new mongoose.Types.ObjectId(),
      accountId: [parents[0], parents[1], parents[0]],
      costCents: 30,
    },
    ...excluded.map((fields) => ({
      ...base,
      ...fields,
      _id: new mongoose.Types.ObjectId(),
      costCents: 1_000_000,
    })),
  ];
  try {
    await Orders.collection.insertMany(orders as never[]);
    await Lines.collection.insertMany(lines as never[]);
    const after = await selectedMetrics(
      "accounts",
      parents.map(String),
      select,
    );
    for (const [index, row] of after.entries()) {
      assert.equal(row.id, before[index].id);
      assert.equal(
        row.grossRevenueCents,
        before[index].grossRevenueCents + 100,
      );
      assert.equal(row.netRevenueCents, before[index].netRevenueCents + 80);
      assert.equal(row.revenueOrderCount, before[index].revenueOrderCount + 1);
      assert.equal(row.costCents, before[index].costCents + 30);
    }
  } finally {
    await Orders.collection.deleteMany({
      _id: { $in: orders.map((row) => row._id) },
    });
    await Lines.collection.deleteMany({
      _id: { $in: lines.map((row) => row._id) },
    });
  }
});

test("unselected numeric filters still reject overflow after batch-loaded arithmetic", async () => {
  const accountId = oid(3, 0, 0),
    productId = oid(4, 0, 0);
  const orderId = new mongoose.Types.ObjectId(),
    inventoryId = new mongoose.Types.ObjectId();
  try {
    await Orders.collection.insertOne({
      _id: orderId,
      tenantId: oid(1, 0, 0),
      deletedAt: null,
      accountId,
      placedAt: SINCE + 1,
      status: "paid",
      totalCents: Number.MAX_VALUE,
      refundedCents: -Number.MAX_VALUE,
    } as never);
    await Inventories.collection.insertOne({
      _id: inventoryId,
      tenantId: oid(1, 0, 0),
      deletedAt: null,
      productId,
      warehouse: "overflow",
      onHand: Number.MAX_VALUE,
      reserved: -Number.MAX_VALUE,
    });
    for (const [entity, id, field] of [
      ["accounts", accountId, "netRevenueCents"],
      ["products", productId, "available"],
    ] as const) {
      const query = {
        select: { id: true },
        where: {
          $and: [{ id: { $eq: String(id) } }, { [field]: { $gte: 0 } }],
        },
      };
      const response = await fetch(
        host!.url +
          `/api/adira/${entity}?query=${encodeURIComponent(JSON.stringify(query))}`,
      );
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, "ReadValidationError");
    }
  } finally {
    await Orders.collection.deleteOne({ _id: orderId });
    await Inventories.collection.deleteOne({ _id: inventoryId });
  }
});
