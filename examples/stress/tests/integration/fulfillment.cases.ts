import assert from "node:assert/strict";
import { test } from "node:test";
import { nativePriority } from "../../server/accounts/triage.reference";
import { AS_OF, DAY } from "../../server/clock";
import { Orders } from "../../server/database/models";
import { priority } from "../../server/orders/rules";
import { customRead } from "./fixtures";

test("the alternative order implementation prunes its custom provider when no shortage is requested", async () => {
  const result = await customRead(
    "orders",
    { select: { id: true, number: true }, page: { limit: 2 } },
    "adira-batched",
  );
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.telemetry.callbacks, {});
  assert.equal(result.telemetry.commands, 1);
});

test("the native reference's priority formula matches JavaScript across representative amounts, ages and statuses", async () => {
  const samples = [0, 1000, 31_000, 300_000, 1_000_000].flatMap((totalCents) =>
    [0, 0.25, 2.5, 14.5, 30].flatMap((age) =>
      ["pending", "paid"].map((status) => ({
        totalCents,
        status,
        placedAt: AS_OF - age * DAY,
      })),
    ),
  );
  const results = await Orders.collection
    .aggregate<{
      totalCents: number;
      status: string;
      placedAt: number;
      priority: number;
    }>([
      { $limit: 1 },
      { $project: { _id: 0, samples: { $literal: samples } } },
      { $unwind: "$samples" },
      { $replaceWith: "$samples" },
      { $set: { priority: nativePriority } },
    ])
    .toArray();
  assert.equal(results.length, samples.length);
  for (const row of results)
    assert.equal(
      row.priority,
      priority(row.totalCents, row.status, (AS_OF - row.placedAt) / DAY),
    );
});
