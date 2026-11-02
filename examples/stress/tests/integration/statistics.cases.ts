import mongoose from "mongoose";
import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from "../../harness/benchmarks/run";
import { inspect } from "../../harness/readers.adira";
import { oid } from "../../harness/seed";
import { newTrace } from "../../harness/telemetry";
import { workloads } from "../../harness/workloads";
import { AS_OF, SINCE } from "../../server/clock";
import { Accounts, Orders } from "../../server/database/models";
import { customRead, host } from "./fixtures";

test("complete relation statistics are independent of include offsets; empty and tied relations keep exact semantics", async () => {
  const tenantId = oid(1, 0, 0),
    ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const orderIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ].sort((a, b) => String(a).localeCompare(String(b)));
  try {
    await Accounts.collection.insertMany(
      ids.map((_id, i) => ({
        _id,
        tenantId,
        deletedAt: null,
        name: `Stats fixture ${i}`,
        region: "EU",
        tier: "growth",
        managerId: oid(2, 0, 0),
        creditLimitCents: 100_000,
        joinedAt: SINCE,
      })),
    );
    await Orders.collection.insertMany(
      orderIds.map((_id, i) => ({
        _id,
        tenantId,
        deletedAt: null,
        accountId: ids[0],
        managerId: oid(2, 0, 0),
        region: "EU",
        number: `Stats order ${i}`,
        status: "paid",
        placedAt: AS_OF - 1,
        totalCents: [100, 300, 300][i],
        refundedCents: 0,
      })),
    );
    const body = await customRead("accounts", {
      select: {
        id: true,
        recentOrderCount: true,
        recentOrderAverage: true,
        recentOrderMin: true,
        recentOrderMax: true,
        latestPaidOrderCents: true,
        orders: {
          select: { id: true, netCents: true },
          orderBy: { netCents: "desc", id: "asc" },
          page: { offset: 1, limit: 1 },
        },
      },
      where: { $or: ids.map((id) => ({ id: { $eq: String(id) } })) },
      orderBy: { id: "asc" },
    });
    const full = body.rows.find((r: { id: string }) => r.id === String(ids[0]));
    assert.equal(full.recentOrderCount, 3);
    assert.equal(full.recentOrderAverage, 700 / 3);
    assert.equal(full.recentOrderMin, 100);
    assert.equal(full.recentOrderMax, 300);
    assert.equal(
      full.latestPaidOrderCents,
      100,
      "Latest tie uses id ascending",
    );
    assert.deepEqual(full.orders, [{ id: String(orderIds[2]), netCents: 300 }]);
    const empty = body.rows.find(
      (r: { id: string }) => r.id === String(ids[1]),
    );
    assert.deepEqual(empty, {
      id: String(ids[1]),
      recentOrderCount: 0,
      recentOrderAverage: null,
      recentOrderMin: null,
      recentOrderMax: null,
      latestPaidOrderCents: null,
      orders: [],
    });
    assert.equal(body.telemetry.callbacks.revenueBatch, undefined);
    assert.equal(body.telemetry.callbacks.fulfillmentScore, undefined);
  } finally {
    await Orders.collection.deleteMany({ _id: { $in: orderIds } });
    await Accounts.collection.deleteMany({ _id: { $in: ids } });
  }
});

test("programmatic manager grouping shares work within a resolver batch and stays demand driven", async () => {
  const workload = workloads.find((w) => w.id === "portfolioConcentration")!;
  const result = await request(host!.url, "adira", workload);
  assert.equal(result.status, 200);
  const counts = result.body.telemetry!.callbacks;
  assert.ok(counts.managerPortfolioParents > counts.uniqueManagers);
  assert.equal(counts.costBatch, undefined);
  const directory = await customRead("accounts", {
    select: { name: true },
    page: { limit: 1 },
  });
  assert.deepEqual(directory.telemetry.callbacks, {});
});

test("reduction membership runs before pagination while display-only financial callbacks run for selected accounts", async () => {
  const workload = workloads.find((w) => w.id === "revenueQuality")!;
  const plan = inspect("accounts", workload.query, {
    tenantId: oid(1, 0, 0),
    trace: newTrace(),
  });
  assert.deepEqual(
    plan.reductionGroups?.map(({ loads, phase }) => ({ loads, phase })),
    [
      {
        loads: [
          "recentOrderCount",
          "recentOrderAverage",
          "recentOrderMin",
          "recentOrderMax",
        ],
        phase: "membership",
      },
    ],
  );
  const result = await request(host!.url, "adira", workload);
  assert.equal(result.status, 200);
  const counts = result.body.telemetry!.callbacks;
  assert.equal(counts.costParents, result.body.rows!.length);
  assert.equal(counts.revenueParents, result.body.rows!.length);
  assert.equal(counts.marginBps, result.body.rows!.length);
});
