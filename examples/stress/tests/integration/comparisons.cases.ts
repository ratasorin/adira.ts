import assert from "node:assert/strict";
import { test } from "node:test";
import { digest } from "../../harness/benchmarks/run";
import { oid } from "../../harness/seed";
import { newTrace, traces } from "../../harness/telemetry";
import { comparisons } from "../../queries";
import "./fixtures";

for (const comparison of comparisons) {
  test(`query comparison: ${comparison.id}`, async () => {
    for (const tenant of [0, 1]) {
      const context = { tenantId: oid(1, tenant, 0), trace: newTrace() };
      const actual = await traces.run(context.trace, () =>
        comparison.adira(context),
      );
      const expected = await traces.run(context.trace, () =>
        comparison.mongo(context),
      );
      assert.equal(digest(actual), digest(expected), comparison.title);
    }
  });
}
