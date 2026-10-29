import { setTimeout } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { redis, cacheKey, flightKey, jobKey, publishJob, releaseFlight, } from "./connections";
import { artifactExists, payloadHash } from "./cache";
import { config } from "../config/env";
import type { RenderPayload, StoredJob, PreviewJobResponse } from "./contracts";
export async function readJob(id: string, owner: string): Promise<StoredJob | null> {
    const raw = await redis.get(jobKey(id));
    if (!raw)
        return null;
    const job: StoredJob = JSON.parse(raw);
    return job.owner === owner ? job : null;
}
function response(job: StoredJob): PreviewJobResponse {
    const { owner, hash, ...publicJob } = job;
    return { ...publicJob, statusUrl: `/api/invoice/jobs/${job.id}` };
}
export async function submitJob(owner: string, body: unknown, payload: RenderPayload): Promise<PreviewJobResponse> {
    const hash = payloadHash(owner, body, payload);
    const cachedId = await redis.get(cacheKey(hash));
    if (cachedId) {
        const cached = await readJob(cachedId, owner);
        if (cached?.status === "ready" && (await artifactExists(cachedId)))
            return response({ ...cached, cache: "HIT" });
        await redis.del(cacheKey(hash));
    }
    const id = randomUUID();
    const acquired = await redis.set(flightKey(hash), id, { NX: true, EX: 3600 });
    if (!acquired) {
        const existingId = await redis.get(flightKey(hash));
        let existing = existingId ? await readJob(existingId, owner) : null;
        for (let attempt = 0; !existing && existingId && attempt < 5; attempt++) {
            await setTimeout(10);
            existing = await readJob(existingId, owner);
        }
        if (existing && existing.status !== "failed")
            return response({ ...existing, cache: "COALESCED" });
        // A publisher may still be recording the job, so let the client retry.
        throw Object.assign(new Error("Preview is being scheduled; retry shortly"), { status: 503 });
    }
    const status: StoredJob = {
        id,
        owner,
        hash,
        status: "queued",
        cache: "MISS",
        createdAt: Date.now(),
    };
    try {
        await redis.set(jobKey(id), JSON.stringify(status), {
            EX: config.cacheSeconds + 3600,
        });
        await publishJob({ id, owner, hash, payload, attempts: 0 });
        return response(status);
    }
    catch (error) {
        await redis.del(jobKey(id));
        await releaseFlight(hash, id);
        throw error;
    }
}
