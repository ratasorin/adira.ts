// Analysis-only Service Risk variants using the existing public Adira API.
// Run after `npm run stress:build`; never changes the production reader.
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { writeFile } = require("node:fs/promises");
const assert = require("node:assert/strict");
const workspace = createRequire(resolve(__dirname, "../../../package.json"));
const mongoose = workspace("mongoose");
const { defineResource, field, schema } = workspace("@n/adira.core.ts");
const { createReadContext } = workspace("@n/adira.backend.ts");
const { Accounts, Orders, Tickets, Shipments, connect } = workspace(
  "./examples/stress/dist/server/models.js",
);
const { temporaryMongo } = workspace("./examples/stress/dist/server/mongo.js");
const { seed, oid } = workspace("./examples/stress/dist/server/seed.js");
const { newTrace, monitor, traces, count } = workspace(
  "./examples/stress/dist/server/telemetry.js",
);
const { executeAdira } = workspace("./examples/stress/dist/server/adira.js");
const { executeReference } = workspace(
  "./examples/stress/dist/server/reference.js",
);
const { AccountResource } = workspace(
  "./examples/stress/dist/server/resources.js",
);
const { risk } = workspace("./examples/stress/dist/server/fixtures/workloads.js");
const { SINCE, riskScore, riskBand } = workspace(
  "./examples/stress/dist/server/business.js",
);
const { digest } = workspace("./examples/stress/dist/server/benchmark.js");

const reads = createReadContext();
const Resource = defineResource(
  Object.fromEntries(
    [
      "id",
      "name",
      "region",
      "tier",
      "netRevenueCents",
      "openTicketCount",
      "lateShipmentCount",
      "riskScore",
      "riskBand",
    ].map((key) => [key, AccountResource.fields[key]]),
  ),
);
const Value = defineResource({ value: field.number() });
const Summary = defineResource({
  netRevenueCents: field.number(),
  openTicketCount: field.number(),
  lateShipmentCount: field.number(),
  exposureCents: field.number(),
});
const summarySchema = schema.object({
  netRevenueCents: schema.number(),
  openTicketCount: schema.number(),
  lateShipmentCount: schema.number(),
  exposureCents: schema.number(),
});
const key = String;
const rootSource = () =>
  reads.mongo
    .from(Accounts, {
      scope: (e, c) =>
        e.and(
          e.eq(e.field("tenantId"), c.tenantId),
          e.isNull(e.field("deletedAt")),
        ),
    })
    .derive("id", (e) => e.toString(e.field("_id")));

function withNativeRevenue(source) {
  return source
    .native({
      provides: ["grossRevenueCents", "refundedCents", "revenueOrderCount"],
      requires: ["_id", "tenantId"],
      stages: [
        {
          $lookup: {
            from: Orders.collection.name,
            localField: "_id",
            foreignField: "accountId",
            let: { tenant: "$tenantId" },
            pipeline: [
              {
                $match: {
                  deletedAt: null,
                  placedAt: { $gte: SINCE },
                  status: { $in: ["paid", "shipped"] },
                  $expr: { $eq: ["$tenantId", "$$tenant"] },
                },
              },
              {
                $group: {
                  _id: null,
                  gross: { $sum: "$totalCents" },
                  refunded: { $sum: "$refundedCents" },
                  count: { $sum: 1 },
                },
              },
            ],
            as: "_finance",
          },
        },
        {
          $set: {
            grossRevenueCents: {
              $ifNull: [{ $arrayElemAt: ["$_finance.gross", 0] }, 0],
            },
            refundedCents: {
              $ifNull: [{ $arrayElemAt: ["$_finance.refunded", 0] }, 0],
            },
            revenueOrderCount: {
              $ifNull: [{ $arrayElemAt: ["$_finance.count", 0] }, 0],
            },
          },
        },
        { $unset: "_finance" },
      ],
      output: schema.object({
        grossRevenueCents: schema.number(),
        refundedCents: schema.number(),
        revenueOrderCount: schema.number(),
      }),
    })
    .derive("netRevenueCents", (e) =>
      e.add(
        e.field("grossRevenueCents"),
        e.multiply(e.field("refundedCents"), e.literal(-1)),
      ),
    );
}

// Preserve scalar policy/filter semantics for the two managed counts. The
// ordinary predicates are necessary filters; exact expressions remain active.
function countMatch(ids, c, kind) {
  const exact = [
    { $eq: [{ $ifNull: ["$tenantId", null] }, { $literal: c.tenantId }] },
    { $eq: [{ $ifNull: ["$deletedAt", null] }, null] },
    kind === "tickets"
      ? {
          $in: [
            { $ifNull: ["$status", null] },
            { $literal: ["open", "pending"] },
          ],
        }
      : { $eq: [{ $ifNull: ["$late", null] }, { $literal: true }] },
  ];
  return {
    accountId: { $in: ids },
    tenantId: c.tenantId,
    ...(kind === "tickets"
      ? { status: { $in: ["open", "pending"] } }
      : { late: true }),
    $expr: { $and: exact },
  };
}
function correlate(ids) {
  // A foreign array can match a scalar parent in MongoDB. Count each child
  // once per matching key, preserving the original lookup's association.
  return [
    {
      $set: {
        __roi_keys: {
          $cond: [
            { $isArray: "$accountId" },
            { $setIntersection: ["$accountId", { $literal: ids }] },
            ["$accountId"],
          ],
        },
      },
    },
    { $unwind: "$__roi_keys" },
  ];
}
async function aggregateMetric(kind, parents, context) {
  count(context, kind + "Batch");
  const ids = [
    ...new Map(parents.map(({ row }) => [key(row._id), row._id])).values(),
  ];
  let model, match, group, project;
  if (kind === "tickets" || kind === "shipments") {
    model = kind === "tickets" ? Tickets : Shipments;
    match = countMatch(ids, context, kind);
    group = { _id: "$__roi_keys", value: { $sum: 1 } };
  } else {
    model = Orders;
    // Preserve the current custom revenue/exposure business matches.
    match = {
      accountId: { $in: ids },
      tenantId: context.tenantId,
      deletedAt: null,
      status: {
        $in: kind === "revenue" ? ["paid", "shipped"] : ["pending", "paid"],
      },
    };
    if (kind === "revenue") {
      match.placedAt = { $gte: SINCE };
      match.$expr = { $eq: ["$tenantId", { $literal: context.tenantId }] };
      group = {
        _id: "$__roi_keys",
        gross: { $sum: "$totalCents" },
        refunded: { $sum: "$refundedCents" },
      };
      project = { $project: { value: { $subtract: ["$gross", "$refunded"] } } };
    } else {
      group = {
        _id: "$accountId",
        value: { $sum: { $subtract: ["$totalCents", "$refundedCents"] } },
      };
    }
  }
  const pipeline = [
    { $match: match },
    ...(kind === "exposure" ? [] : correlate(ids)),
    { $group: group },
    ...(project ? [project] : []),
  ];
  const rows = await model.collection.aggregate(pipeline).toArray();
  return new Map(
    rows.map((row) => [key(row._id), schema.number().parse(row.value)]),
  );
}
function metric(source, kind) {
  return source
    .related({
      requires: ["_id"],
      output: schema.object({ value: schema.number() }),
      resolveBatch: async ({ parents, context }) => {
        const map = await aggregateMetric(kind, parents, context);
        return parents.map(({ ref, row }) => ({
          ref,
          rows: [{ value: map.get(key(row._id)) ?? 0 }],
        }));
      },
    })
    .many(Value)
    .sum({ field: "value" });
}
function makeReader(mode, batchSize = 128) {
  let source = rootSource();
  if (mode === "bulk-counts") source = withNativeRevenue(source);
  source = source.toApp({ batchSize, concurrency: 8 });
  if (mode === "bulk-counts" || mode === "bulk-sequential") {
    if (mode !== "bulk-counts")
      source = source.load("netRevenueCents", metric(source, "revenue"));
    source = source
      .load("openTicketCount", metric(source, "tickets"))
      .load("lateShipmentCount", metric(source, "shipments"))
      .load("exposureCents", metric(source, "exposure"));
  } else {
    const inputs = source
      .related({
        requires: ["_id"],
        output: summarySchema,
        resolveBatch: async ({ parents, context }) => {
          count(context, "summaryBatch");
          const [revenue, tickets, shipments, exposure] = await Promise.all([
            aggregateMetric("revenue", parents, context),
            aggregateMetric("tickets", parents, context),
            aggregateMetric("shipments", parents, context),
            aggregateMetric("exposure", parents, context),
          ]);
          return parents.map(({ ref, row }) => ({
            ref,
            rows: [
              {
                netRevenueCents: revenue.get(key(row._id)) ?? 0,
                openTicketCount: tickets.get(key(row._id)) ?? 0,
                lateShipmentCount: shipments.get(key(row._id)) ?? 0,
                exposureCents: exposure.get(key(row._id)) ?? 0,
              },
            ],
          }));
        },
      })
      .one(Summary);
    source = source.load(
      "inputs",
      inputs.get({
        select: {
          netRevenueCents: true,
          openTicketCount: true,
          lateShipmentCount: true,
          exposureCents: true,
        },
      }),
    );
    for (const field of [
      "netRevenueCents",
      "openTicketCount",
      "lateShipmentCount",
      "exposureCents",
    ])
      source = source.derive(field, ["inputs"], (row) => row.inputs[field]);
  }
  source = source
    .derive(
      "riskScore",
      [
        "netRevenueCents",
        "openTicketCount",
        "lateShipmentCount",
        "creditLimitCents",
        "exposureCents",
      ],
      (row, context) => {
        count(context, "riskScore");
        return riskScore(row);
      },
    )
    .derive("riskBand", ["riskScore"], (row, context) => {
      count(context, "riskBand");
      return riskBand(row.riskScore);
    });
  return reads.defineRead(Resource, {
    source,
    limits: { defaultLimit: 40, maxLimit: 100, maxCandidates: 10000 },
  });
}

async function main() {
  const db = await temporaryMongo();
  try {
    await connect(db.uri);
    const metadata = await seed("medium", false, () => {});
    console.log("Seeded private medium database");
    monitor();
    const readers = {
      "bulk-counts": makeReader("bulk-counts"),
      "bulk-sequential": makeReader("bulk-sequential"),
      "bulk-parallel-128": makeReader("bulk-parallel", 128),
      "bulk-parallel-512": makeReader("bulk-parallel", 512),
    };
    const modes = ["current", ...Object.keys(readers), "reference"];
    const samples = [],
      parity = [],
      expected = new Map();
    const active = new Map(),
      cursorPhases = new Map();
    const client = mongoose.connection.getClient();
    client.on("commandStarted", (event) => {
      const trace = traces.getStore();
      if (!trace?.profile) return;
      let phase;
      if (event.commandName === "getMore")
        phase = cursorPhases.get(String(event.command.getMore));
      else if (["aggregate", "find"].includes(event.commandName)) {
        phase = event.command.aggregate ?? event.command.find;
        if (
          event.command.pipeline?.some(
            (stage) => stage.$lookup?.as === "__adira_values",
          )
        )
          phase += ":parent-scoped";
      } else return;
      assert.ok(phase);
      active.set(event.requestId, { trace, phase });
    });
    client.on("commandSucceeded", (event) => {
      const pending = active.get(event.requestId);
      if (!pending) return;
      active.delete(event.requestId);
      const group = (pending.trace.profile.phases[pending.phase] ??= {
        commands: 0,
        mongoMs: 0,
      });
      group.commands++;
      group.mongoMs += event.duration;
      const cursor = event.reply.cursor;
      if (cursor && String(cursor.id) !== "0")
        cursorPhases.set(String(cursor.id), pending.phase);
    });
    async function run(mode, tenant, measured) {
      const trace = newTrace();
      if (measured) trace.profile = { phases: {} };
      const c = { tenantId: oid(1, tenant, 0), trace };
      const result = await traces.run(trace, () =>
        mode === "current"
          ? executeAdira("accounts", risk, c)
          : mode === "reference"
            ? executeReference("risk", c)
            : readers[mode](risk, c),
      );
      const elapsedMs = performance.now() - trace.started;
      const hash = digest(result);
      if (!expected.has(tenant)) expected.set(tenant, hash);
      assert.equal(hash, expected.get(tenant), mode + "/tenant-" + tenant);
      assert.equal(trace.callbacks.riskScore, 486);
      if (measured)
        samples.push({
          mode,
          elapsedMs,
          commands: trace.commands,
          mongoMs: trace.mongoMs,
          callbacks: trace.callbacks,
          phases: trace.profile.phases,
          digest: hash,
        });
      return hash;
    }
    for (const tenant of [0, 3])
      for (const mode of [
        "reference",
        ...modes.filter((m) => m !== "reference"),
      ])
        parity.push({ mode, tenant, digest: await run(mode, tenant, false) });
    console.log("All variants match the reference in first and last tenants");
    for (let n = 0; n < 2; n++)
      for (const mode of modes) await run(mode, 0, false);
    for (let n = 0; n < 12; n++) {
      const rotated = modes
        .slice(n % modes.length)
        .concat(modes.slice(0, n % modes.length));
      for (const mode of n % 2 ? rotated.reverse() : rotated)
        await run(mode, 0, true);
      console.log("Measured iteration", n + 1);
    }
    const percentile = (xs, p) =>
      [...xs].sort((x, y) => x - y)[Math.ceil(xs.length * p) - 1];
    const summaries = modes.map((mode) => {
      const rows = samples.filter((s) => s.mode === mode);
      const avg = (f) => rows.reduce((sum, s) => sum + f(s), 0) / rows.length;
      return {
        mode,
        samples: rows.length,
        p50Ms: percentile(
          rows.map((s) => s.elapsedMs),
          0.5,
        ),
        p95Ms: percentile(
          rows.map((s) => s.elapsedMs),
          0.95,
        ),
        meanMs: avg((s) => s.elapsedMs),
        meanCommands: avg((s) => s.commands),
        meanMongoMs: avg((s) => s.mongoMs),
      };
    });
    const plans = Object.fromEntries(
      Object.entries(readers).map(([mode, read]) => [
        mode,
        read.inspect(risk, { tenantId: oid(1, 0, 0), trace: newTrace() }),
      ]),
    );
    await writeFile(
      resolve(__dirname, "query-roi-experiment.json"),
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          metadata,
          method:
            "Service Risk only; direct executors; six variants, same process/database, two warmups each, twelve sequential samples each with rotated/reversed order, first/last-tenant parity. All variants use existing public APIs; no library feature changes. Correlation takes a scalar fast path and intersects only foreign arrays; exposure retains its existing raw grouping. Bundled parallel variants trade independent field pruning for manual concurrency. No HTTP timing or concurrency-4 measurement.",
          limitations: [
            "Experimental narrower risk resource; not a replacement for all AccountResource capabilities or a generic optimizer.",
            "JavaScript experiment; public output schemas and runtime policies are enforced, but this is not a TypeScript inference test.",
            "Bulk count/revenue variants normalize original foreign array keys and keep exact managed-count policies/filters; exposure retains its existing raw grouping. All variants preserve the demo's existing revenue/exposure business matches.",
            "Different batch sizes and bundled inputs change execution granularity; repeated independent field work under other selections is not measured.",
            "Twelve local samples are exploratory; driver times overlap in parallel variants and cannot be summed as request wall time.",
          ],
          parity,
          summaries,
          samples,
          plans,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify(summaries, null, 2));
  } finally {
    await mongoose.disconnect();
    await db.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
