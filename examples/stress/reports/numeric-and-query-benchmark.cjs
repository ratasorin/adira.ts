// Analysis harness: real readers, one private seed, interleaved implementations.
// Capture baseline compiled modules before rebuilding; see the comparison report.
const { createRequire } = require("node:module");
const { resolve, dirname } = require("node:path");
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const { createHash } = require("node:crypto");
const { cpus } = require("node:os");
const assert = require("node:assert/strict");
const workspace = createRequire(resolve(__dirname, "../../../package.json"));
const mongoose = workspace("mongoose");
const current = workspace("@n/adira.backend.ts");
const { defineResource, field } = workspace("@n/adira.core.ts");
const { Accounts, Orders, models, connect } = workspace(
  "./examples/stress/dist/server/models.js",
);
const { seed, profiles, oid, option } = workspace(
  "./examples/stress/dist/server/seed.js",
);
const { temporaryMongo } = workspace("./examples/stress/dist/server/mongo.js");
const { monitor, newTrace, traces } = workspace(
  "./examples/stress/dist/server/telemetry.js",
);
const { digest } = workspace("./examples/stress/dist/server/benchmark.js");
const { SINCE } = workspace("./examples/stress/dist/server/business.js");
const { workloads } = workspace("./examples/stress/dist/server/fixtures/workloads.js");
const afterDemo = workspace("./examples/stress/dist/server/adira.js");
const { executeReference } = workspace(
  "./examples/stress/dist/server/reference.js",
);
const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};
const childWhere = {
  placedAt: { $gte: SINCE },
  status: { $in: ["paid", "shipped"] },
};
const parentWhere = {
  region: { $in: ["EU", "NA"] },
  tier: { $in: ["growth", "enterprise"] },
};
const Numeric = defineResource({
  netCents: field.number(),
  placedAt: field.number().filterable("$gte"),
  status: field.string().filterable("$in"),
});
const Stats = defineResource({
  id: field.string().orderable(),
  region: field.string().filterable("$in"),
  tier: field.string().filterable("$in"),
  average: field.number().nullable(),
  minimum: field.number().nullable(),
  maximum: field.number().nullable(),
});
function numericReader(backend) {
  const reads = backend.createReadContext();
  const scope = (e, c) =>
    e.and(
      e.eq(e.field("tenantId"), c.tenantId),
      e.isNull(e.field("deletedAt")),
    );
  const parent = reads.mongo
    .from(Accounts, { scope })
    .derive("id", (e) => e.toString(e.field("_id")))
    .toApp({ batchSize: 128, concurrency: 8 });
  const child = reads.mongo
    .from(Orders, { scope })
    .derive("netCents", (e) =>
      e.add(
        e.field("totalCents"),
        e.multiply(e.field("refundedCents"), e.literal(-1)),
      ),
    );
  const orders = parent
    .related(child, { localField: "_id", foreignField: "accountId" })
    .many(Numeric);
  const source = parent
    .load("average", orders.avg({ field: "netCents", where: childWhere }))
    .load("minimum", orders.min({ field: "netCents", where: childWhere }))
    .load("maximum", orders.max({ field: "netCents", where: childWhere }));
  return reads.defineRead(Stats, {
    source,
    limits: { defaultLimit: 2000, maxLimit: 2000, maxCandidates: 10000 },
  });
}
async function numericReference(query, context) {
  const parents = await Accounts.find({
    tenantId: context.tenantId,
    deletedAt: null,
    region: { $in: ["EU", "NA"] },
    tier: { $in: ["growth", "enterprise"] },
  })
    .sort({ _id: 1 })
    .lean();
  const values = await Orders.aggregate([
    {
      $match: {
        tenantId: context.tenantId,
        deletedAt: null,
        accountId: { $in: parents.map((p) => p._id) },
        placedAt: { $gte: SINCE },
        status: { $in: ["paid", "shipped"] },
      },
    },
    {
      $group: {
        _id: "$accountId",
        average: { $avg: { $subtract: ["$totalCents", "$refundedCents"] } },
        minimum: { $min: { $subtract: ["$totalCents", "$refundedCents"] } },
        maximum: { $max: { $subtract: ["$totalCents", "$refundedCents"] } },
      },
    },
  ]);
  const byId = new Map(values.map((v) => [String(v._id), v]));
  return {
    rows: parents.map((parent) =>
      Object.fromEntries(
        Object.keys(query.select).map((key) => [
          key,
          key === "id"
            ? String(parent._id)
            : (byId.get(String(parent._id))?.[key] ?? null),
        ]),
      ),
    ),
  };
}
async function run() {
  const baselineReadPath = option("baseline-read");
  const baselineDemoPath = option("baseline-demo");
  if (!baselineReadPath || !baselineDemoPath)
    throw new Error(
      "Pass --baseline-read and --baseline-demo captured compiled module paths",
    );
  const before = workspace(resolve(baselineReadPath));
  const beforeDemo = workspace(resolve(baselineDemoPath));
  const profile = option("profile", "medium");
  if (!Object.hasOwn(profiles, profile)) throw new Error("Unknown profile");
  const iterations = Number(option("iterations", "12"));
  const warmups = Number(option("warmup", "2"));
  const concurrency = option("concurrency", "1,4").split(",").map(Number);
  const caseGroup = option("cases", "all");
  if (!["all", "numeric", "demo"].includes(caseGroup))
    throw new Error("--cases must be all, numeric or demo");
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < 1 ||
    !Number.isSafeInteger(warmups) ||
    warmups < 0 ||
    concurrency.some((n) => !Number.isSafeInteger(n) || n < 1 || n > 32)
  )
    throw new Error("Invalid benchmark settings");
  const db = await temporaryMongo();
  try {
    await connect(db.uri);
    await seed(profile);
    monitor();
    const beforeNumeric = numericReader(before),
      afterNumeric = numericReader(current);
    const cases = [
      ...[
        ["avg", { id: true, average: true }],
        ["min", { id: true, minimum: true }],
        ["max", { id: true, maximum: true }],
        [
          "all-numeric",
          { id: true, average: true, minimum: true, maximum: true },
        ],
      ].map(([id, select]) => {
        const query = {
          select,
          where: parentWhere,
          orderBy: { id: "asc" },
          page: { limit: 2000 },
        };
        return {
          id: `numeric/${id}`,
          kind: "numeric",
          query,
          before: (c) => beforeNumeric(query, c),
          after: (c) => afterNumeric(query, c),
          reference: (c) => numericReference(query, c),
          measureReference: false,
          plans: (c) => ({
            before: beforeNumeric.inspect(query, c),
            after: afterNumeric.inspect(query, c),
          }),
        };
      }),
      ...workloads.map((workload) => ({
        id: `demo/${workload.id}`,
        kind: "demo",
        query: workload.query,
        before: (c) =>
          beforeDemo.executeAdira(workload.entity, workload.query, c),
        after: (c) =>
          afterDemo.executeAdira(workload.entity, workload.query, c),
        reference: (c) => executeReference(workload.id, c),
        measureReference: true,
        plans: (c) => ({
          before: beforeDemo.inspect(workload.entity, workload.query, c),
          after: afterDemo.inspect(workload.entity, workload.query, c),
        }),
      })),
    ].filter((item) => caseGroup === "all" || item.kind === caseGroup);
    const parity = [],
      samples = [],
      summaries = [],
      plans = {};
    const expected = new Map();
    for (const item of cases) {
      for (const tenant of [...new Set([0, profiles[profile].tenants - 1])]) {
        const context = { tenantId: oid(1, tenant, 0), trace: newTrace() };
        const reference = await item.reference(context);
        assert.ok(reference.rows.length > 0, `${item.id} must return rows`);
        const hash = digest(reference);
        for (const variant of ["before", "after"]) {
          assert.equal(
            digest(await item[variant](context)),
            hash,
            `${item.id}/${variant}/tenant-${tenant}`,
          );
          parity.push({
            case: item.id,
            variant,
            tenant,
            rows: reference.rows.length,
            digest: hash,
          });
        }
        if (!tenant) expected.set(item.id, hash);
      }
      plans[item.id] = item.plans({
        tenantId: oid(1, 0, 0),
        trace: newTrace(),
      });
      console.log(`Parity ${item.id}: before/after/reference, two tenants`);
    }
    async function measure(item, variant, workers) {
      const context = { tenantId: oid(1, 0, 0), trace: newTrace() };
      const started = performance.now();
      const result = await traces.run(context.trace, () =>
        item[variant](context),
      );
      const elapsedMs = performance.now() - started;
      assert.equal(
        digest(result),
        expected.get(item.id),
        `${item.id}/${variant} changed during timing`,
      );
      return {
        case: item.id,
        variant,
        concurrency: workers,
        elapsedMs,
        commands: context.trace.commands,
        mongoMs: context.trace.mongoMs,
        callbacks: context.trace.callbacks,
      };
    }
    for (const [index, item] of cases.entries()) {
      const variants = item.measureReference
        ? ["before", "after", "reference"]
        : ["before", "after"];
      for (let n = 0; n < warmups; n++)
        for (const variant of variants) await measure(item, variant, 1);
      for (const workers of concurrency) {
        const groups = new Map(variants.map((variant) => [variant, []]));
        for (
          let start = 0, round = 0;
          start < iterations;
          start += workers, round++
        ) {
          const rotation = (round + index) % variants.length;
          const order = [
            ...variants.slice(rotation),
            ...variants.slice(0, rotation),
          ];
          for (const variant of order) {
            const group = await Promise.all(
              Array.from(
                { length: Math.min(workers, iterations - start) },
                () => measure(item, variant, workers),
              ),
            );
            groups.get(variant).push(...group);
            samples.push(...group);
          }
        }
        for (const variant of variants) {
          const values = groups.get(variant);
          const summary = {
            case: item.id,
            variant,
            concurrency: workers,
            samples: values.length,
            p50Ms: quantile(
              values.map((v) => v.elapsedMs),
              0.5,
            ),
            p95Ms: quantile(
              values.map((v) => v.elapsedMs),
              0.95,
            ),
            meanCommands:
              values.reduce((n, v) => n + v.commands, 0) / values.length,
            meanMongoMs:
              values.reduce((n, v) => n + v.mongoMs, 0) / values.length,
          };
          summaries.push(summary);
          console.log(
            `${item.id} ${variant} c=${workers}: p50=${summary.p50Ms.toFixed(1)}ms p95=${summary.p95Ms.toFixed(1)}ms commands=${summary.meanCommands.toFixed(1)}`,
          );
        }
      }
    }
    const hashFile = async (path) =>
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
    const output = resolve(
      option(
        "output",
        "examples/stress/reports/numeric-and-query-experiment.json",
      ),
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(
      output,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          environment: {
            node: process.version,
            mongodb: (await mongoose.connection.db.admin().buildInfo()).version,
            cpu: cpus()[0]?.model,
            mongoCacheGB: 0.25,
            transport:
              "Direct executors in one Node process/pool; interleaved implementation waves on the same private database",
          },
          settings: {
            caseGroup,
            profile,
            iterations,
            warmups,
            concurrency,
            parentBatchSize: 128,
            rowConcurrency: 8,
          },
          metadata: await mongoose.connection.db
            .collection("stress_metadata")
            .findOne({ _id: "dataset" }),
          controls: {
            baselineReadPath,
            baselineDemoPath,
            baselineExecutorSHA256: await hashFile(
              resolve(dirname(baselineReadPath), "execute.js"),
            ),
            currentExecutorSHA256: await hashFile(
              workspace.resolve("./packages/backend/dist/read/execute.js"),
            ),
            baselineDemoSHA256: await hashFile(resolve(baselineDemoPath)),
            currentDemoSHA256: await hashFile(
              workspace.resolve("./examples/stress/dist/server/adira.js"),
            ),
            note: "The demo control uses its captured old query declarations with the current backend. These dashboard queries do not use avg/min/max, so their only execution difference is the example rewrite. Numeric controls use the captured preceding backend module.",
          },
          parity,
          summaries,
          samples,
          plans,
          indexes: Object.fromEntries(
            await Promise.all(
              models.map(async (model) => [
                model.collection.name,
                await model.collection.indexes(),
              ]),
            ),
          ),
          limitations: [
            "Synthetic warm-cache measurements; not production capacity",
            "Direct executor measurements exclude HTTP/serialization",
            "Small local sample counts and external system load can affect timing",
            "Separate loads remain sequential; no batch-size increase or parallel callback bundle",
            "Numeric reference is an untimed correctness oracle; demo reference is measured",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`Report: ${output}`);
  } finally {
    await mongoose.disconnect();
    await db.stop();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
