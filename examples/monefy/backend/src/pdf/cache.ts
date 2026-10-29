import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config/env";
export const RENDERER_VERSION = "monefy-pdf-v4";
export function canonicalJSON(value: unknown): string {
    if (value instanceof Date)
        return JSON.stringify(value.toISOString());
    if (Array.isArray(value))
        return `[${value.map(canonicalJSON).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b, "en"))
            .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`)
            .join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
}
export function payloadHash(owner: string, body: unknown, resolved: unknown): string {
    return createHash("sha256")
        .update(canonicalJSON({ owner, body, resolved, version: RENDERER_VERSION }))
        .digest("hex");
}
export function artifactPath(id: string): string {
    if (!/^[a-f0-9-]{36}$/.test(id))
        throw new Error("Invalid artifact ID");
    return join(config.artifactDir, `${id}.pdf`);
}
export async function artifactExists(id: string) {
    try {
        await access(artifactPath(id));
        return true;
    }
    catch {
        return false;
    }
}
export function developmentDelayMs(env = process.env): number {
    return env.PDF_DEVELOPMENT_DELAY === "true"
        ? 4500
        : 0;
}
