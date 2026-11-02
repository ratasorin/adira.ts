import type { RequestHandler } from "express";
import { ApiError } from "../utils/api-errors";
export const decodeApiQuery: RequestHandler = (req, _res, next) => {
    try {
        if (typeof req.query.query === "string") {
            const parsed: unknown = JSON.parse(req.query.query);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
                throw new ApiError(400, "Invalid query");
            req.query = parsed as typeof req.query;
        }
        next();
    }
    catch (error) {
        next(error instanceof ApiError ? error : new ApiError(400, "Invalid JSON query"));
    }
};
