import { createClient } from "redis";
import amqp, { type ConfirmChannel, type ChannelModel } from "amqplib";
import { config } from "../config/env";
export const redis = createClient({ url: config.redis });
redis.on("error", (error) => console.error("Redis connection:", error.message));
export const QUEUE = "monefy.pdf.render";
export const DEAD_QUEUE = "monefy.pdf.failed";
let connection: ChannelModel;
export let channel: ConfirmChannel;
let closing = false;
export async function connectServices() {
    await redis.connect();
    connection = await amqp.connect(config.rabbit, {
        timeout: 5000,
        heartbeat: 10,
    });
    connection.on("error", (error) => console.error("Queue connection:", error.message));
    connection.on("close", () => {
        if (!closing)
            process.exit(1);
    });
    channel = await connection.createConfirmChannel();
    channel.on("error", (error) => {
        console.error("Queue channel:", error.message);
        process.exit(1);
    });
    await channel.assertQueue(DEAD_QUEUE, { durable: true });
    await channel.assertQueue(QUEUE, {
        durable: true,
        arguments: {
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": DEAD_QUEUE,
            "x-max-length": 1000,
            "x-overflow": "reject-publish",
        },
    });
}
export async function publishJob(job: unknown) {
    await new Promise<void>((resolve, reject) => {
        channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(job)), { persistent: true, contentType: "application/json" }, (error) => (error ? reject(error) : resolve()));
    });
}
export async function closeServices() {
    closing = true;
    await channel?.close().catch(() => { });
    await connection?.close().catch(() => { });
    if (redis.isOpen)
        await redis.quit();
}
export const jobKey = (id: string) => `monefy:pdf:job:${id}`;
export const cacheKey = (hash: string) => `monefy:pdf:cache:${hash}`;
export const flightKey = (hash: string) => `monefy:pdf:flight:${hash}`;
export async function releaseFlight(hash: string, id: string) {
    await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", { keys: [flightKey(hash)], arguments: [id] });
}
