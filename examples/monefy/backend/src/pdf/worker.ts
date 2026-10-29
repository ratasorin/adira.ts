import { mkdir, rename, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config/env";
import { redis, connectServices, closeServices, channel, QUEUE, cacheKey, flightKey, jobKey, publishJob, releaseFlight, } from "./connections";
import { artifactPath, artifactExists } from "./cache";
import { renderPdf } from "./render";
import type { PdfJob, StoredJob } from "./contracts";
const workerId = randomUUID();
let stopping = false;
async function cleanup() {
    const expiry = Date.now() - (config.cacheSeconds + 3600) * 1000;
    for (const name of await readdir(config.artifactDir)) {
        if (!/^[a-f0-9-]{36}(\.pdf|\.[a-f0-9-]+\.tmp)$/.test(name))
            continue;
        const path = join(config.artifactDir, name);
        try {
            if ((await stat(path)).mtimeMs < expiry)
                await unlink(path);
        }
        catch {
            /* Another worker may have cleaned this file. */
        }
    }
}
async function main() {
    await mkdir(config.artifactDir, { recursive: true });
    await connectServices();
    const heartbeat = async () => {
        await redis.set(`monefy:worker:${workerId}`, "ready", { EX: 30 });
    };
    await heartbeat();
    const timer = setInterval(() => heartbeat().catch(console.error), 5000);
    const sweeper = setInterval(() => cleanup().catch(console.error), 60000);
    await cleanup();
    await channel.prefetch(1);
    let active: Promise<void> | undefined;
    const consumer = await channel.consume(QUEUE, (message) => {
        if (!message)
            return;
        active = (async () => {
            let job: PdfJob | undefined;
            let temporary: string | undefined;
            try {
                job = JSON.parse(message.content.toString());
                if (!job || !job.id || !job.hash || !job.payload)
                    throw new Error("Invalid queued document");
                const raw = await redis.get(jobKey(job.id));
                if (!raw) {
                    channel.ack(message);
                    await releaseFlight(job.hash, job.id);
                    return;
                }
                const previous: StoredJob = JSON.parse(raw);
                if (previous.status === "ready" && (await artifactExists(job.id))) {
                    channel.ack(message);
                    await releaseFlight(job.hash, job.id);
                    return;
                }
                const started = Date.now();
                const status: StoredJob = { ...previous, status: "processing" };
                await redis.set(jobKey(job.id), JSON.stringify(status), {
                    EX: config.cacheSeconds + 3600,
                });
                temporary = join(config.artifactDir, `${job.id}.${randomUUID()}.tmp`);
                await renderPdf(job.payload, temporary);
                await rename(temporary, artifactPath(job.id));
                temporary = undefined;
                const ready: StoredJob = {
                    ...status,
                    status: "ready",
                    completedAt: Date.now(),
                    renderMs: Date.now() - started,
                    artifactUrl: `/api/invoice/artifacts/${job.id}`,
                };
                await redis
                    .multi()
                    .set(jobKey(job.id), JSON.stringify(ready), {
                    EX: config.cacheSeconds,
                })
                    .set(cacheKey(job.hash), job.id, { EX: config.cacheSeconds })
                    .exec();
                await releaseFlight(job.hash, job.id);
                channel.ack(message);
            }
            catch (error) {
                console.error("PDF job failed:", error instanceof Error ? error.message : error);
                if (temporary)
                    await unlink(temporary).catch(() => { });
                if (job && job.attempts < 2) {
                    await publishJob({ ...job, attempts: job.attempts + 1 });
                    channel.ack(message);
                }
                else {
                    if (job) {
                        await redis.set(jobKey(job.id), JSON.stringify({
                            id: job.id,
                            owner: job.owner,
                            hash: job.hash,
                            status: "failed",
                            cache: "MISS",
                            createdAt: Date.now(),
                            message: "PDF generation failed. Please retry.",
                        }), { EX: config.cacheSeconds });
                        await releaseFlight(job.hash, job.id);
                    }
                    channel.nack(message, false, false);
                }
            }
        })().catch((error) => {
            console.error(error);
            process.exit(1);
        });
    });
    for (const signal of ["SIGTERM", "SIGINT"])
        process.on(signal, async () => {
            if (stopping)
                return;
            stopping = true;
            await channel.cancel(consumer.consumerTag);
            await active;
            clearInterval(timer);
            clearInterval(sweeper);
            await redis.del(`monefy:worker:${workerId}`);
            await closeServices();
            process.exit(0);
        });
    console.log("Monefy PDF worker ready");
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
