import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, freemem, loadavg, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { connect } from "../../server/database/models";
import { listen } from "../http/app";
import { temporaryMongo } from "../mongo";
import { option, profiles, seed, type Profile } from "../seed";
import { monitor } from "../telemetry";
import { workloads, type WorkloadId } from "../workloads";
import { expressivityProbes } from "../workloads/rejections";
import { businessSources, sourceHashes } from "./sources";

export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}
export const digest = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export interface Payload {
  rows?: unknown[];
  [key: string]: unknown;
  error?: string;
  message?: string;
  telemetry?: {
    commands: number;
    serverMs: number;
    mongoMs: number;
    dataBytes: number;
    callbacks: Record<string, number>;
    memory: { rss: number; heapUsed: number };
  };
}
/** Compare business data independently of per-request execution telemetry. */
export function responseData({ telemetry: _telemetry, ...data }: Payload) {
  return data;
}
export type Backend = "adira" | "adiraBatched" | "reference";
const actorsFor = (id: WorkloadId): Backend[] =>
  id === "fulfillment"
    ? ["adira", "adiraBatched", "reference"]
    : ["adira", "reference"];
const rotate = <T>(values: readonly T[], offset: number): T[] => {
  const split = offset % values.length;
  return [...values.slice(split), ...values.slice(0, split)];
};
export async function request(
  url: string,
  backend: Backend,
  workload: (typeof workloads)[number],
  tenant = 0,
): Promise<{
  body: Payload;
  elapsedMs: number;
  status: number;
  bytes: number;
}> {
  const path =
    backend === "reference"
      ? `/api/reference/${workload.id}`
      : `/api/${backend === "adiraBatched" ? "adira-batched" : "adira"}/${workload.entity}?query=${encodeURIComponent(JSON.stringify(workload.query))}`;
  const start = performance.now();
  const response = await fetch(url + path, {
    headers: { "x-tenant-index": String(tenant) },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  return {
    body: JSON.parse(text),
    elapsedMs: performance.now() - start,
    status: response.status,
    bytes: Buffer.byteLength(text),
  };
}
export function assertParity(a: Payload, b: Payload, label: string) {
  if (a.error || b.error)
    throw new Error(
      `${label}: backend error ${JSON.stringify({ adira: a, reference: b })}`,
    );
  if (digest(responseData(a)) !== digest(responseData(b)))
    throw new Error(
      `${label}: result mismatch\nAdira: ${JSON.stringify(responseData(a)).slice(0, 3500)}\nReference: ${JSON.stringify(responseData(b)).slice(0, 3500)}`,
    );
}
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0
  );
};
export async function runBenchmark() {
  const profile = option("profile", "medium") as Profile;
  if (!Object.hasOwn(profiles, profile)) throw new Error("Unknown profile");
  const iterations = Number(option("iterations", "12")),
    warmups = Number(option("warmup", "2")),
    concurrency = option("concurrency", "1,4").split(",").map(Number);
  if (
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    !Number.isInteger(warmups) ||
    warmups < 0 ||
    concurrency.some((n) => !Number.isInteger(n) || n < 1 || n > 64)
  )
    throw new Error("Invalid benchmark parameters");
  const external = option("uri", process.env.STRESS_MONGO_URI),
    temporary = external ? undefined : await temporaryMongo();
  let host: Awaited<ReturnType<typeof listen>> | undefined;
  try {
    await connect(external || temporary!.uri);
    if (temporary || process.argv.includes("--seed"))
      await seed(profile, process.argv.includes("--reset"));
    const metadata = await mongoose.connection
      .db!.collection("stress_metadata")
      .findOne({ _id: "dataset" as never });
    if (!metadata)
      throw new Error("External database needs an existing seed or --seed");
    monitor();
    host = await listen("both", 0);
    const chosen = option("workloads");
    const cases = chosen
      ? workloads.filter((w) => chosen.split(",").includes(w.id))
      : workloads;
    if (!cases.length) throw new Error("No matching workloads");
    const parity = [];
    for (const workload of cases)
      for (const tenant of [
        ...new Set([0, (metadata.config as { tenants: number }).tenants - 1]),
      ]) {
        const a = await request(host.url, "adira", workload, tenant),
          b = await request(host.url, "reference", workload, tenant);
        assertParity(a.body, b.body, `${workload.id}/tenant-${tenant}`);
        if (workload.id === "fulfillment") {
          const batched = await request(
            host.url,
            "adiraBatched",
            workload,
            tenant,
          );
          assertParity(
            batched.body,
            b.body,
            `${workload.id}/batched/tenant-${tenant}`,
          );
        }
        const rows = a.body.rows ?? [];
        for (const row of rows) {
          const id = (row as { id?: string }).id;
          if (id && Number.parseInt(id.slice(2, 6), 16) !== tenant)
            throw new Error("Cross-tenant result");
        }
        parity.push({
          workload: workload.id,
          tenant,
          rows: rows.length,
          digest: digest(responseData(a.body)),
          backends: actorsFor(workload.id),
        });
        console.log(
          `Parity ${workload.id}/tenant-${tenant}: ${rows.length} rows`,
        );
      }
    const samples: {
      workload: WorkloadId;
      backend: string;
      concurrency: number;
      elapsedMs: number;
      serverMs: number;
      mongoMs: number;
      commands: number;
      bytes: number;
      callbacks: Record<string, number>;
      rss: number;
      heapUsed: number;
      wave: number;
    }[] = [];
    const summaries: Record<string, unknown>[] = [];
    const lag = monitorEventLoopDelay({ resolution: 20 });
    const startingLoad = loadavg();
    lag.enable();
    for (const [caseIndex, workload] of cases.entries()) {
      const actors = actorsFor(workload.id);
      const expected = parity.find(
        (p) => p.workload === workload.id && p.tenant === 0,
      )!.digest;
      for (let i = 0; i < warmups; i++)
        for (const backend of rotate(actors, i)) {
          const response = await request(host.url, backend, workload);
          if (
            response.status !== 200 ||
            digest(responseData(response.body)) !== expected
          )
            throw new Error(`Warmup failed: ${workload.id}/${backend}`);
        }
      for (const workers of concurrency) {
        const groups: Record<Backend, typeof samples> = {
          adira: [],
          adiraBatched: [],
          reference: [],
        };
        const wall: Record<Backend, number> = {
          adira: 0,
          adiraBatched: 0,
          reference: 0,
        };
        // Rotate engines after every wave; engines never compete with each other.
        // A multiple of actors.length waves balances all execution positions.
        for (
          let start = 0, wave = 0;
          start < iterations;
          start += workers, wave++
        ) {
          for (const backend of rotate(actors, caseIndex + wave)) {
            const started = performance.now();
            const waveSamples = await Promise.all(
              Array.from(
                { length: Math.min(workers, iterations - start) },
                async () => {
                  const response = await request(host!.url, backend, workload);
                  if (response.status !== 200 || response.body.error)
                    throw new Error(
                      `${backend}/${workload.id}: ${JSON.stringify(response.body)}`,
                    );
                  if (digest(responseData(response.body)) !== expected)
                    throw new Error("Output changed during measurement");
                  const t = response.body.telemetry!;
                  return {
                    workload: workload.id,
                    backend,
                    concurrency: workers,
                    elapsedMs: response.elapsedMs,
                    serverMs: t.serverMs,
                    mongoMs: t.mongoMs,
                    commands: t.commands,
                    bytes: response.bytes,
                    callbacks: t.callbacks,
                    rss: t.memory.rss,
                    heapUsed: t.memory.heapUsed,
                    wave,
                  };
                },
              ),
            );
            wall[backend] += performance.now() - started;
            groups[backend].push(...waveSamples);
          }
        }
        for (const backend of actors) {
          const group = groups[backend];
          samples.push(...group);
          const summary = {
            workload: workload.id,
            backend,
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
            p99Ms: percentile(
              group.map((s) => s.elapsedMs),
              0.99,
            ),
            requestsPerSecond: (group.length * 1000) / wall[backend],
            meanServerMs:
              group.reduce((n, s) => n + s.serverMs, 0) / group.length,
            meanCommands:
              group.reduce((n, s) => n + s.commands, 0) / group.length,
            meanMongoMs:
              group.reduce((n, s) => n + s.mongoMs, 0) / group.length,
            meanBytes: group.reduce((n, s) => n + s.bytes, 0) / group.length,
          };
          summaries.push(summary);
          console.log(
            `${workload.id} ${backend} c=${workers}: p50=${summary.p50Ms.toFixed(1)}ms p95=${summary.p95Ms.toFixed(1)}ms commands=${summary.meanCommands.toFixed(1)}`,
          );
        }
      }
    }
    lag.disable();
    const budgetResponse = await fetch(host.url + "/api/diagnostics/budget");
    const budget = await budgetResponse.json();
    const plans = Object.fromEntries(
      await Promise.all(
        cases.map(async (w) => {
          const response = await fetch(
            host!.url +
              `/api/adira/plan/${w.entity}?query=${encodeURIComponent(JSON.stringify(w.query))}`,
          );
          return [w.id, responseData(await response.json())];
        }),
      ),
    );
    const explanations: Record<string, unknown> = {};
    const commandTraces: Record<string, unknown> = {};
    if (process.argv.includes("--explain"))
      for (const workload of cases) {
        console.log(`Untimed executionStats: ${workload.id}`);
        const response = await fetch(
          host.url + `/api/diagnostics/explain/${workload.id}`,
          { signal: AbortSignal.timeout(120_000) },
        );
        explanations[workload.id] = await response.json();
        if (workload.id === "fulfillment") {
          const optimized = await fetch(
            host.url +
              `/api/adira-batched/plan/orders?query=${encodeURIComponent(JSON.stringify(workload.query))}`,
          );
          plans["fulfillment/adiraBatched"] = responseData(
            await optimized.json(),
          );
        }
        for (const backend of actorsFor(workload.id)) {
          const trace = await fetch(
            host.url +
              `/api/diagnostics/commands/${workload.id}?backend=${backend}`,
            { signal: AbortSignal.timeout(120_000) },
          );
          if (!trace.ok)
            throw new Error(`Command trace failed: ${workload.id}/${backend}`);
          commandTraces[`${workload.id}/${backend}`] = responseData(
            await trace.json(),
          );
        }
      }
    const expressivity = [];
    for (const probe of expressivityProbes) {
      const response = await fetch(
        host.url +
          `/api/adira/accounts?query=${encodeURIComponent(JSON.stringify(probe.query))}`,
      );
      const body = await response.json();
      if (response.status !== 400 || body.telemetry.commands !== 0)
        throw new Error(`Expressivity boundary changed: ${probe.id}`);
      expressivity.push({
        ...probe,
        status: response.status,
        error: body.error,
        message: body.message,
        commands: body.telemetry.commands,
      });
    }
    const indexes = await (
      await fetch(host.url + "/api/diagnostics/indexes")
    ).json();
    let mongoVersion = "unavailable";
    try {
      mongoVersion = (await mongoose.connection.db!.admin().buildInfo())
        .version;
    } catch {}
    const result = {
      createdAt: new Date().toISOString(),
      environment: {
        node: process.version,
        mongodb: mongoVersion,
        os: `${platform()} ${release()}`,
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length,
        totalMemory: totalmem(),
        freeMemory: freemem(),
        startingLoad,
        finishingLoad: loadavg(),
        mongoCacheGB: temporary ? 0.25 : "external",
        transport:
          "HTTP loopback; both engines share one Node process and one MongoDB pool",
      },
      metadata,
      sourceHashes: await sourceHashes(resolve(__dirname, "../../.."), [
        ...(await businessSources(resolve(__dirname, "../../.."))),
        "harness/benchmarks/run.ts",
        "harness/telemetry.ts",
        "harness/http/app.ts",
        "harness/http/transport.ts",
        "harness/http/diagnostics.ts",
      ]),
      settings: {
        iterations,
        warmups,
        concurrency,
        scheduling:
          "cyclic engine order between waves; no mixed-engine contention",
      },
      parity,
      summaries,
      samples,
      budget,
      plans,
      explanations,
      commandTraces,
      expressivity,
      indexes: responseData(indexes),
      eventLoop: { meanMs: lag.mean / 1e6, p99Ms: lag.percentile(99) / 1e6 },
      limitations: [
        "Local synthetic workload, not a production capacity claim",
        "Node RSS/heap samples are process-wide and include both implementations and the load generator",
        "Warm database caches; no cold-cache flush or authentication/TLS/load-balancer overhead",
        "Per-request Mongo command durations can overlap; sum is not wall-clock database latency",
        "Small sample p95/p99 values require larger iteration counts for stable estimates",
        "Concurrency uses fixed request waves with barriers; req/s is not a sustained-arrival production capacity measurement",
        "Reference endpoints are hand-optimized for these fixed dashboard views, not arbitrary frontend selections",
        "executionStats covers root native pipelines only; it excludes deferred commands and application callbacks",
      ],
    };
    const output = resolve(
      option("output", `results/${profile}-${Date.now()}`),
    );
    await mkdir(output, { recursive: true });
    await writeFile(
      resolve(output, "report.json"),
      JSON.stringify(result, null, 2),
    );
    const md = [
      `# Adira Operations Lab — ${metadata.profile}`,
      ``,
      `${Object.values(metadata.counts as Record<string, number>)
        .reduce((a, b) => a + b, 0)
        .toLocaleString()} documents. ${parity.length} parity checks passed. ${iterations} samples per variant/concurrency.`,
      ``,
      "| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |",
      "|---|---|---:|---:|---:|---:|---:|",
      ...summaries.map(
        (s) =>
          `| ${s.workload} | ${s.backend} | ${s.concurrency} | ${(s.p50Ms as number).toFixed(1)} | ${(s.p95Ms as number).toFixed(1)} | ${(s.meanCommands as number).toFixed(1)} | ${(s.requestsPerSecond as number).toFixed(1)} |`,
      ),
      "",
      "Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.",
      "",
    ].join("\n");
    await writeFile(resolve(output, "report.md"), md);
    console.log(`Report: ${output}`);
    return result;
  } finally {
    if (host)
      await new Promise<void>((resolve, reject) =>
        host!.server.close((error) => (error ? reject(error) : resolve())),
      );
    await mongoose.disconnect();
    await temporary?.stop();
  }
}
if (require.main === module)
  runBenchmark().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
