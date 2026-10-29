import type { RequestHandler } from "express";
import { ApiError } from "../utils/api-errors";
function strip(value: unknown, path: string[]): void {
    if (Array.isArray(value)) {
        value.forEach(item => strip(item, path));
        return;
    }
    if (!value || typeof value !== "object")
        return;
    const record = value as Record<string, unknown>;
    const [key, ...rest] = path;
    if (!rest.length)
        delete record[key];
    else
        strip(record[key], rest);
}
export const protectInputKeys = (keys: readonly string[]): RequestHandler => (req, _res, next) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        next(new ApiError(400, "Expected an object request body"));
        return;
    }
    for (const key of keys)
        strip(req.body, key.split("."));
    next();
};
