import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from "../../harness/benchmarks/run";
import { listen } from "../../harness/http/app";
import { seed } from "../../harness/seed";
import { workloads } from "../../harness/workloads";
import { expressivityProbes } from "../../harness/workloads/rejections";
import { Accounts } from "../../server/database/models";
import { host } from "./fixtures";

test("unsupported frontend shapes fail before database work and diagnostics capture complete command sequences", async () => {
  for (const probe of expressivityProbes) {
    const response = await fetch(
      host!.url +
        `/api/adira/accounts?query=${encodeURIComponent(JSON.stringify(probe.query))}`,
    );
    const body = await response.json();
    assert.equal(response.status, 400, probe.id);
    assert.equal(body.telemetry.commands, 0, probe.id);
  }
  for (const backend of ["adira", "reference"]) {
    const response = await fetch(
      host!.url + `/api/diagnostics/commands/fulfillment?backend=${backend}`,
    );
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.commands.length, body.telemetry.commands);
    assert.ok(
      body.commands.some(
        (c: { collection?: string }) => c.collection === "stress_lines",
      ),
    );
    assert.ok(
      body.commands.every(
        (c: { durationMs?: number }) => typeof c.durationMs === "number",
      ),
    );
  }
});

test("reference-only deployment serves its own views and rejects Adira routes", async () => {
  const reference = await listen("reference", 0);
  try {
    const response = await request(reference.url, "reference", workloads[0]);
    assert.equal(response.status, 200);
    assert.equal(response.body.telemetry?.callbacks.riskScore, undefined);
    const absent = await fetch(reference.url + "/api/adira/accounts");
    assert.equal(absent.status, 404);
    assert.equal((await absent.json()).error, "NotFound");
  } finally {
    await new Promise<void>((resolve) =>
      reference.server.close(() => resolve()),
    );
  }
});

test("invalid fields, types, page limits and tenant indices fail before database commands", async () => {
  for (const query of [
    { select: { secret: true } },
    { select: { name: true }, where: { riskScore: { $gte: "bad" } } },
    { select: { name: true }, page: { limit: 999 } },
  ]) {
    const response = await fetch(
      host!.url +
        `/api/adira/accounts?query=${encodeURIComponent(JSON.stringify(query))}`,
    );
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.telemetry.commands, 0);
  }
  const invalid = await fetch(host!.url + "/api/reference/directory", {
    headers: { "x-tenant-index": "999" },
  });
  assert.equal(invalid.status, 400);
});

test("seed refuses accidental overwrite and data includes soft deletes and uneven accounts", async () => {
  await assert.rejects(
    seed("smoke", false, () => {}),
    /already exists/,
  );
  assert.ok(await Accounts.countDocuments({ deletedAt: { $ne: null } }));
});

test("budget diagnostic reports complete-history cardinality and native explain is available", async () => {
  const response = await fetch(host!.url + "/api/diagnostics/budget");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(body.reference.candidates > 0);
  const explain = await fetch(host!.url + "/api/diagnostics/explain/directory");
  assert.equal(explain.status, 200);
  assert.ok((await explain.json()).explanation);
});
