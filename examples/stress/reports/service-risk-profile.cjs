// Read-only request profiling against a fresh private medium seed.
// Run from any directory after `npm run stress:build`.
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { writeFile } = require("node:fs/promises");
const assert = require("node:assert/strict");
const root = resolve(__dirname, "../../..");
const workspace = createRequire(resolve(root, "package.json"));
const mongoose = workspace("mongoose");
const { temporaryMongo } = workspace("./examples/stress/dist/server/mongo.js");
const { connect } = workspace("./examples/stress/dist/server/models.js");
const { seed, oid } = workspace("./examples/stress/dist/server/seed.js");
const { monitor, newTrace, traces } = workspace(
  "./examples/stress/dist/server/telemetry.js",
);
const { executeAdira } = workspace("./examples/stress/dist/server/adira.js");
const { executeReference } = workspace(
  "./examples/stress/dist/server/reference.js",
);
const { risk } = workspace("./examples/stress/dist/server/fixtures/workloads.js");
const { digest } = workspace("./examples/stress/dist/server/benchmark.js");

// Risk-specific A/B probe: remove only generated ordinary helper matches next
// to Adira's null-normalized exact expressions. Keep those expressions, stage
// placement, and raw business matches. This is not the historical compiler.
function expressionOnly(stages) {
  return stages.map((stage) => {
    let next = stage;
    if (
      stage.$match?.$expr &&
      JSON.stringify(stage.$match.$expr).includes('"$ifNull"')
    )
      next = { ...stage, $match: { $expr: stage.$match.$expr } };
    if (stage.$lookup?.pipeline)
      next = {
        ...next,
        $lookup: {
          ...stage.$lookup,
          pipeline: expressionOnly(stage.$lookup.pipeline),
        },
      };
    if (stage.$facet)
      next = {
        ...next,
        $facet: Object.fromEntries(
          Object.entries(stage.$facet).map(([key, pipeline]) => [
            key,
            expressionOnly(pipeline),
          ]),
        ),
      };
    return next;
  });
}

async function main() {
  const database = await temporaryMongo();
  const Collection = mongoose.mongo.Collection;
  const aggregate = Collection.prototype.aggregate;
  try {
    await connect(database.uri);
    const metadata = await seed("medium", false, () => {});
    console.log("Seeded private medium database");
    monitor();
    Collection.prototype.aggregate = function (pipeline, options) {
      if (traces.getStore()?.profile?.backend === "adira-expr-only")
        pipeline = expressionOnly(pipeline);
      return aggregate.call(this, pipeline, options);
    };
    const active = new Map();
    const cursors = new Map();
    const runs = [];
    const pipelines = {};
    const client = mongoose.connection.getClient();
    client.on("commandStarted", (event) => {
      const trace = traces.getStore();
      if (!trace?.profile) return;
      const command = event.command;
      let phase;
      if (event.commandName === "getMore") {
        phase = cursors.get(String(command.getMore));
      } else if (event.commandName === "find") {
        phase = "accounts";
      } else if (event.commandName === "aggregate") {
        const collection = command.aggregate;
        const perParent = command.pipeline.some(
          (stage) => stage.$lookup?.as === "__adira_values",
        );
        if (collection === "stress_accounts")
          phase = "accounts + revenue/cost lookups";
        if (collection === "stress_tickets")
          phase = perParent
            ? "parent-scoped ticket counts"
            : "bulk ticket counts";
        if (collection === "stress_shipments")
          phase = perParent
            ? "parent-scoped shipment counts"
            : "bulk shipment counts";
        if (collection === "stress_orders")
          phase = command.pipeline.some((stage) => stage.$group?.gross)
            ? "bulk revenue"
            : "bulk exposure";
        if (!phase) phase = collection;
        pipelines[trace.profile.backend + ":" + phase] ??= command.pipeline;
      } else return;
      assert.ok(phase, `Unclassified command: ${event.commandName}`);
      const entry = {
        phase,
        command: event.commandName,
        startMs: performance.now() - trace.started,
      };
      trace.profile.commands.push(entry);
      active.set(event.requestId, entry);
    });
    client.on("commandSucceeded", (event) => {
      const entry = active.get(event.requestId);
      if (!entry) return;
      active.delete(event.requestId);
      entry.durationMs = event.duration;
      const cursor = event.reply.cursor;
      entry.returned = (cursor?.firstBatch ?? cursor?.nextBatch ?? []).length;
      if (cursor && String(cursor.id) !== "0")
        cursors.set(String(cursor.id), entry.phase);
    });
    client.on("commandFailed", (event) => {
      const entry = active.get(event.requestId);
      if (entry) throw new Error(`Profile command failed: ${entry.phase}`);
    });
    let expected;
    async function request(backend, measured) {
      const trace = newTrace();
      const run = { backend, commands: [] };
      if (measured) trace.profile = run;
      const context = { tenantId: oid(1, 0, 0), trace };
      const result = await traces.run(trace, () =>
        backend === "reference"
          ? executeReference("risk", context)
          : executeAdira("accounts", risk, context),
      );
      const hash = digest(result);
      expected ??= hash;
      assert.equal(hash, expected);
      if (measured) {
        run.elapsedMs = performance.now() - trace.started;
        run.digest = hash;
        run.callbacks = trace.callbacks;
        run.phases = {};
        for (const command of run.commands) {
          const phase = (run.phases[command.phase] ??= {
            commands: 0,
            mongoMs: 0,
          });
          phase.commands++;
          phase.mongoMs += command.durationMs;
        }
        runs.push(run);
        console.log(
          backend,
          run.elapsedMs.toFixed(1),
          "ms",
          JSON.stringify(run.phases),
        );
      }
    }
    await request("adira", false);
    await request("reference", false);
    // Give the experimental query shapes one untimed warmup as well.
    await request("adira-expr-only", true);
    runs.length = 0;
    for (let iteration = 0; iteration < 4; iteration++)
      for (const backend of iteration % 2
        ? ["reference", "adira-expr-only", "adira"]
        : ["adira", "adira-expr-only", "reference"])
        await request(backend, true);
    await writeFile(
      resolve(__dirname, "service-risk-profile.json"),
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          method:
            "Four sequential direct executor invocations per backend/query mode, alternating order, after one warmup each. Driver timings include getMore; independent reference queries overlap. adira-expr-only strips generated ordinary helper matches from this risk workload while keeping exact expressions, raw business matches, and current stage placement. It is a query-shape A/B probe, not the historical compiler or a replacement for the HTTP benchmark.",
          metadata,
          runs,
          pipelines,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    Collection.prototype.aggregate = aggregate;
    await mongoose.disconnect();
    await database.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
