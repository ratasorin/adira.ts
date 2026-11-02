/** Paired executor comparison. Capture the old compiled reader before rebuilding. */
import { readRecord } from "@n/adira.core.ts";
import express from "express";
import mongoose from "mongoose";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { cpus, loadavg, platform, release } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { connect } from "../../server/database/models";
import { temporaryMongo } from "../mongo";
import { executeAdira, inspect } from "../readers.adira";
import { executeReference } from "../readers.reference";
import { oid, option, profiles, seed, type Profile } from "../seed";
import { monitor, newTrace, traces, type RequestContext } from "../telemetry";
import { workloads } from "../workloads";
import { digest, responseData, type Payload } from "./run";
import { businessSources, hashFile } from "./sources";

const variants = ["before", "after", "reference"] as const;
type Variant = (typeof variants)[number];
type Workload = (typeof workloads)[number];
type Implementation = Pick<
  typeof import("../readers.adira"),
  "executeAdira" | "inspect"
>;
interface Baseline {
  layout: "business-v3";
  readModule: string;
  demoModule: string;
  demoDirectory: string;
  sources: Record<string, string>;
}
interface Summary {
  workload: string;
  variant: Variant;
  concurrency: number;
  samples: number;
  p50Ms: number;
  p95Ms: number;
  meanServerMs: number;
  meanMongoMs: number;
  meanCommands: number;
}
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
};

export async function runFusionBenchmark() {
  const root = resolve(__dirname, "../../../../..");
  const sources = await businessSources(resolve(root, "examples/stress"));
  const capturedSources = [
    "packages/backend/read/execute.ts",
    "packages/core/src/read/query.ts",
    ...sources.map((file) => `examples/stress/${file}`),
  ];
  const manifest = resolve(
    option(
      "baseline",
      resolve(root, "node_modules/.adira-fusion-baseline.json"),
    ),
  );
  if (process.argv.includes("--capture-baseline")) {
    const directory = await mkdtemp(
      resolve(root, "node_modules/.adira-fusion-baseline."),
    );
    await cp(
      resolve(root, "packages/backend/dist/read"),
      resolve(directory, "read"),
      { recursive: true },
    );
    const sourceDirectory = resolve(root, "examples/stress/dist");
    const demoDirectory = resolve(directory, "demo");
    const databaseDirectory = resolve(sourceDirectory, "server/database");
    await cp(
      resolve(sourceDirectory, "server"),
      resolve(demoDirectory, "server"),
      {
        recursive: true,
        filter: (source) => source !== databaseDirectory,
      },
    );
    await mkdir(resolve(demoDirectory, "harness"), { recursive: true });
    await cp(
      resolve(sourceDirectory, "harness/readers.adira.js"),
      resolve(demoDirectory, "harness/readers.adira.js"),
    );
    async function rebase(directory: string): Promise<void> {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = resolve(directory, entry.name);
        if (entry.isDirectory()) await rebase(file);
        else if (entry.name.endsWith(".js")) {
          const original = resolve(
            sourceDirectory,
            relative(demoDirectory, file),
          );
          const code = await readFile(file, "utf8");
          await writeFile(
            file,
            code.replace(
              /require\(("|')(\.[^"']+)\1\)/g,
              (match: string, _quote: string, specifier: string) => {
                const target = require.resolve(
                  resolve(dirname(original), specifier),
                );
                return existsSync(
                  resolve(demoDirectory, relative(sourceDirectory, target)),
                )
                  ? match
                  : `require(${JSON.stringify(target)})`;
              },
            ),
          );
        }
      }
    }
    await rebase(demoDirectory);
    const demoModule = resolve(demoDirectory, "harness/readers.adira.js");
    const capture: Baseline = {
      layout: "business-v3",
      readModule: resolve(directory, "read/index.js"),
      demoModule,
      demoDirectory,
      sources: Object.fromEntries(
        await Promise.all(
          capturedSources.map(async (p) => [
            p,
            await hashFile(resolve(root, p)),
          ]),
        ),
      ),
    };
    await writeFile(manifest, JSON.stringify(capture, null, 2) + "\n");
    console.log(`Captured the currently built reader: ${manifest}`);
    return;
  }
  const baseline = JSON.parse(await readFile(manifest, "utf8")) as Baseline;
  assert.equal(
    baseline.layout,
    "business-v3",
    "Capture a baseline with the current directory layout.",
  );
  async function bindBaseline(directory: string): Promise<number> {
    let replacements = 0;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) replacements += await bindBaseline(file);
      else if (entry.name.endsWith(".js")) {
        const code = await readFile(file, "utf8");
        if (code.includes('require("@n/adira.backend.ts")')) {
          await writeFile(
            file,
            code.replaceAll(
              'require("@n/adira.backend.ts")',
              `require(${JSON.stringify(baseline.readModule)})`,
            ),
          );
          replacements++;
        } else if (
          code.includes(`require(${JSON.stringify(baseline.readModule)})`)
        )
          replacements++;
      }
    }
    return replacements;
  }
  assert.ok(
    await bindBaseline(baseline.demoDirectory),
    "Missing captured reader import",
  );
  const before = require(baseline.demoModule) as Implementation;
  for (const [path, expected] of Object.entries(baseline.sources))
    if (path.startsWith("examples/stress/"))
      assert.equal(
        await hashFile(resolve(root, path)),
        expected,
        `${path} changed`,
      );

  const profile = option("profile", "medium") as Profile;
  assert.ok(Object.hasOwn(profiles, profile), "Unknown profile");
  const iterations = Number(option("iterations", "12"));
  const warmups = Number(option("warmup", "2"));
  const concurrency = option("concurrency", "1,4").split(",").map(Number);
  assert.ok(Number.isInteger(iterations) && iterations > 0);
  assert.ok(Number.isInteger(warmups) && warmups >= 0);
  assert.ok(concurrency.every((c) => Number.isInteger(c) && c > 0 && c <= 64));
  const chosen = option("workloads");
  const cases = chosen
    ? workloads.filter((w) => chosen.split(",").includes(w.id))
    : workloads;
  assert.ok(cases.length, "No matching workloads");

  const database = await temporaryMongo();
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  const run = (
    variant: Variant,
    workload: Workload,
    query: unknown,
    context: RequestContext,
  ) =>
    variant === "reference"
      ? executeReference(workload.id, context)
      : (variant === "before" ? before.executeAdira : executeAdira)(
          workload.entity,
          query,
          context,
        );
  try {
    await connect(database.uri);
    await seed(profile, false);
    const metadata = await mongoose.connection
      .db!.collection("stress_metadata")
      .findOne({ _id: "dataset" as never });
    assert.ok(metadata);
    const tenants = (metadata.config as { tenants: number }).tenants;
    monitor();
    const app = express();
    app.disable("x-powered-by");
    app.get("/bench/:variant/:view", async (req, res) => {
      try {
        const variant = req.params.variant as Variant;
        const workload = cases.find((w) => w.id === req.params.view);
        const tenant = Number(req.header("x-tenant-index") ?? 0);
        assert.ok(variants.includes(variant) && workload);
        assert.ok(Number.isInteger(tenant) && tenant >= 0 && tenant < tenants);
        const context = { tenantId: oid(1, tenant, 0), trace: newTrace() };
        const output = await traces.run(context.trace, () =>
          run(
            variant,
            workload,
            variant === "reference"
              ? undefined
              : JSON.parse(String(req.query.query)),
            context,
          ),
        );
        res.json({
          ...readRecord(output, "response data"),
          telemetry: {
            serverMs: performance.now() - context.trace.started,
            mongoMs: context.trace.mongoMs,
            commands: context.trace.commands,
            callbacks: context.trace.callbacks,
            dataBytes: Buffer.byteLength(JSON.stringify(output)),
            memory: process.memoryUsage(),
          },
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((done, reject) => {
      server!.once("listening", done);
      server!.once("error", reject);
    });
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const request = async (
      variant: Variant,
      workload: Workload,
      tenant = 0,
    ) => {
      const start = performance.now();
      const response = await fetch(
        `${url}/bench/${variant}/${workload.id}?query=${encodeURIComponent(JSON.stringify(workload.query))}`,
        {
          headers: { "x-tenant-index": String(tenant) },
          signal: AbortSignal.timeout(120_000),
        },
      );
      const body = (await response.json()) as Payload;
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.ok(
        !body.error && body.rows && body.telemetry,
        JSON.stringify(body),
      );
      return { body, elapsedMs: performance.now() - start };
    };

    const parity = [];
    const expected = new Map<string, string>();
    for (const workload of cases)
      for (const tenant of new Set([0, tenants - 1])) {
        const results = [];
        for (const variant of variants)
          results.push(await request(variant, workload, tenant));
        const output = digest(responseData(results[2].body));
        for (const result of results)
          assert.equal(digest(responseData(result.body)), output);
        assert.deepEqual(
          results[0].body.telemetry!.callbacks,
          results[1].body.telemetry!.callbacks,
        );
        expected.set(`${workload.id}/${tenant}`, output);
        parity.push({
          workload: workload.id,
          tenant,
          rows: results[0].body.rows!.length,
          digest: output,
        });
        console.log(
          `Parity ${workload.id}/tenant-${tenant}: all three executors agree`,
        );
      }

    const samples: {
      workload: string;
      variant: Variant;
      concurrency: number;
      wave: number;
      elapsedMs: number;
      serverMs: number;
      mongoMs: number;
      commands: number;
      callbacks: Record<string, number>;
    }[] = [];
    const summaries: Summary[] = [];
    const startingLoad = loadavg();
    for (const [caseIndex, workload] of cases.entries()) {
      const check = (body: Payload) =>
        assert.equal(
          digest(responseData(body)),
          expected.get(`${workload.id}/0`),
        );
      for (let i = 0; i < warmups; i++)
        for (const variant of variants)
          check((await request(variant, workload)).body);
      for (const workers of concurrency) {
        const collected: Record<Variant, typeof samples> = {
          before: [],
          after: [],
          reference: [],
        };
        for (
          let offset = 0, wave = 0;
          offset < iterations;
          offset += workers, wave++
        ) {
          for (let slot = 0; slot < variants.length; slot++) {
            const variant =
              variants[(caseIndex + wave + slot) % variants.length];
            const values = await Promise.all(
              Array.from(
                { length: Math.min(workers, iterations - offset) },
                async () => {
                  const { body, elapsedMs } = await request(variant, workload);
                  check(body);
                  const t = body.telemetry!;
                  return {
                    workload: workload.id,
                    variant,
                    concurrency: workers,
                    wave,
                    elapsedMs,
                    serverMs: t.serverMs,
                    mongoMs: t.mongoMs,
                    commands: t.commands,
                    callbacks: t.callbacks,
                  };
                },
              ),
            );
            collected[variant].push(...values);
          }
        }
        for (const variant of variants) {
          const group = collected[variant];
          samples.push(...group);
          const mean = (key: "serverMs" | "mongoMs" | "commands") =>
            group.reduce((sum, s) => sum + s[key], 0) / group.length;
          const summary = {
            workload: workload.id,
            variant,
            concurrency: workers,
            samples: group.length,
            p50Ms: percentile(
              group.map((s) => s.elapsedMs),
              0.5,
            ),
            p95Ms: percentile(
              group.map((s) => s.elapsedMs),
              0.95,
            ),
            meanServerMs: mean("serverMs"),
            meanMongoMs: mean("mongoMs"),
            meanCommands: mean("commands"),
          };
          summaries.push(summary);
          console.log(
            `${workload.id} ${variant} c=${workers}: p50=${summary.p50Ms.toFixed(1)}ms p95=${summary.p95Ms.toFixed(1)}ms commands=${summary.meanCommands}`,
          );
        }
      }
    }
    const finishingLoad = loadavg();
    // Capture plans and actual commands only after timing, to avoid trace overhead.
    const plans: Record<string, unknown> = {};
    const commands: Record<string, unknown> = {};
    for (const workload of cases) {
      for (const variant of ["before", "after"] as const)
        plans[`${workload.id}/${variant}`] = (
          variant === "before" ? before.inspect : inspect
        )(workload.entity, workload.query, {
          tenantId: oid(1, 0, 0),
          trace: newTrace(),
        });
      for (const variant of variants) {
        const context: RequestContext = {
          tenantId: oid(1, 0, 0),
          trace: newTrace(),
        };
        context.trace.details = [];
        const output = await traces.run(context.trace, () =>
          run(variant, workload, workload.query, context),
        );
        assert.equal(digest(output), expected.get(`${workload.id}/0`));
        commands[`${workload.id}/${variant}`] = context.trace;
      }
    }
    const paths = [
      ...capturedSources,
      "examples/stress/harness/benchmarks/fusion.ts",
    ];
    const report = {
      createdAt: new Date().toISOString(),
      metadata,
      environment: {
        node: process.version,
        mongodb: (await mongoose.connection.db!.admin().buildInfo()).version,
        os: `${platform()} ${release()}`,
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length,
        startingLoad,
        finishingLoad,
        mongoCacheGB: 0.25,
        transport:
          "HTTP loopback; before, after and native reference share one Node process and Mongo pool; Adira queries are JSON decoded from the URL",
      },
      settings: {
        iterations,
        warmups,
        concurrency,
        scheduling:
          "Cyclic variant order after every wave, no mixed-variant contention",
      },
      baseline: {
        ...baseline,
        readModuleSha256: await hashFile(baseline.readModule),
        executorSha256: await hashFile(
          resolve(baseline.readModule, "../execute.js"),
        ),
        demoModuleSha256: await hashFile(baseline.demoModule),
      },
      sourceHashes: Object.fromEntries(
        await Promise.all(
          paths.map(async (p) => [p, await hashFile(resolve(root, p))]),
        ),
      ),
      parity,
      summaries,
      samples,
      plans,
      commands,
      limitations: [
        "Local synthetic data, warm caches, small fixed-wave samples; not a production capacity claim",
        "All three executors share a process, driver pool and database; variant order rotates but no cold-cache isolation",
        "The native reference is hand-optimized for fixed dashboard views",
        "Per-request summed Mongo durations can overlap; p95 estimates need more samples for stability",
        "Captured pre-change reader shares unchanged demo models, policies and callbacks with the current implementation",
      ],
    };
    const output = resolve(
      option(
        "output",
        resolve(root, "examples/stress/reports/reduction-fusion-paired"),
      ),
    );
    await mkdir(output, { recursive: true });
    await writeFile(
      resolve(output, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    const markdown = [
      "# Compatible native reduction fusion — paired benchmark",
      "",
      `${Object.values(metadata.counts as Record<string, number>)
        .reduce((sum, n) => sum + n, 0)
        .toLocaleString()} documents; ${parity.length} tenant/workload parity checks across all three executors. ${samples.length} measured responses also matched.`,
      "",
      "The same backend declarations and frontend queries run against a captured pre-change reader, the new reader, and the optimized native reference. Cyclic variant order, warm caches, one private MongoDB process. Times include HTTP and query decoding.",
      "",
    ];
    for (const workers of concurrency) {
      markdown.push(
        `## Concurrency ${workers}`,
        "",
        "| Workload | Before p50 ms | After p50 ms | Native p50 ms | Before/after | Commands before → after / native |",
        "|---|---:|---:|---:|---:|---:|",
      );
      for (const workload of cases) {
        const rows = variants.map(
          (v) =>
            summaries.find(
              (s) =>
                s.workload === workload.id &&
                s.concurrency === workers &&
                s.variant === v,
            )!,
        );
        markdown.push(
          `| ${workload.id} | ${rows[0].p50Ms.toFixed(1)} | ${rows[1].p50Ms.toFixed(1)} | ${rows[2].p50Ms.toFixed(1)} | ${(rows[0].p50Ms / rows[1].p50Ms).toFixed(2)}× | ${rows[0].meanCommands} → ${rows[1].meanCommands} / ${rows[2].meanCommands} |`,
        );
      }
      markdown.push("");
    }
    markdown.push(
      "## Limits",
      "",
      ...report.limitations.map((s) => `- ${s}`),
      "",
      "See report.json for raw samples, source hashes, plans and untimed command traces.",
      "",
    );
    await writeFile(resolve(output, "report.md"), markdown.join("\n"));
    console.log(`Saved ${output}`);
  } finally {
    if (server) await new Promise<void>((done) => server!.close(() => done()));
    await mongoose.disconnect();
    await database.stop();
  }
}

if (require.main === module)
  runFusionBenchmark().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
