import assert from "node:assert/strict";
import { test } from "node:test";
import { assertParity, request } from "../../harness/benchmarks/run";
import { workloads } from "../../harness/workloads";
import { host } from "./fixtures";

for (const workload of workloads)
  test(`equivalent ${workload.id} results across two tenants`, async () => {
    for (const tenant of [0, 1]) {
      const a = await request(host!.url, "adira", workload, tenant),
        b = await request(host!.url, "reference", workload, tenant);
      assert.equal(a.status, 200, JSON.stringify(a.body));
      assert.equal(b.status, 200, JSON.stringify(b.body));
      assertParity(a.body, b.body, workload.id);
      if (workload.id === "fulfillment") {
        const batched = await request(
          host!.url,
          "adiraBatched",
          workload,
          tenant,
        );
        assert.equal(batched.status, 200, JSON.stringify(batched.body));
        assertParity(batched.body, b.body, `${workload.id}/batched`);
        assert.ok(batched.body.telemetry!.callbacks.shortageBatch > 0);
        assert.ok(
          batched.body.telemetry!.callbacks.shortageDistinctProducts <
            batched.body.telemetry!.callbacks.shortageLines,
        );
      }
      assert.ok(
        a.body.telemetry!.commands > 0,
        "Driver command monitoring should capture reads",
      );
      assert.ok(
        (a.body.rows?.length ?? 0) > 0,
        "The scenario must produce data",
      );
    }
  });
