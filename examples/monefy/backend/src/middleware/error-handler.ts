import { ZodError } from "zod";
import { type Json, json } from "../types/json";
import { ErrorRequestHandler, Request } from "express";
import mongoose from "mongoose";
import { ApiError } from "../utils/api-errors";
type NormalizedError = {
    status: number;
    message: string;
    code: string;
    expose: boolean;
    metadata?: Record<string, unknown>;
};
const isDuplicateKeyError = (error: unknown) => {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as {
            code?: unknown;
        }).code === 11000);
};
const isStatusError = (error: unknown): error is Error & {
    status: number;
    code?: string;
} => {
    return (error instanceof Error &&
        "status" in error &&
        typeof (error as {
            status?: unknown;
        }).status === "number");
};
const errorMetadata = (error: unknown): Record<string, unknown> | undefined => {
    if (!isDuplicateKeyError(error)) {
        return undefined;
    }
    const duplicateError = error as {
        keyValue?: unknown;
        keyPattern?: unknown;
    };
    return {
        keyValue: duplicateError.keyValue,
        keyPattern: duplicateError.keyPattern,
    };
};
export const normalizeError = (error: unknown): NormalizedError => {
    if (error instanceof ApiError) {
        return {
            status: error.status,
            message: error.message,
            code: error.code,
            expose: error.expose,
            metadata: error.metadata,
        };
    }
    if (error instanceof ZodError || (error instanceof Error && error.name === "ReadValidationError")) {
        return { status: 400, message: "Invalid request fields", code: "VALIDATION_ERROR", expose: true };
    }
    if (isDuplicateKeyError(error)) {
        return {
            status: 409,
            message: "A duplicate record already exists.",
            code: "DUPLICATE_KEY",
            expose: true,
            metadata: errorMetadata(error),
        };
    }
    if (error instanceof mongoose.Error.ValidationError) {
        return {
            status: 400,
            message: error.message,
            code: "VALIDATION_ERROR",
            expose: true,
        };
    }
    if (error instanceof mongoose.Error.CastError) {
        return {
            status: 400,
            message: "Invalid request parameter.",
            code: "INVALID_PARAMETER",
            expose: true,
            metadata: {
                path: error.path,
                value: error.value,
            },
        };
    }
    if (isStatusError(error)) {
        return {
            status: error.status,
            message: error.message,
            code: error.code || "API_ERROR",
            expose: error.status < 500,
        };
    }
    return {
        status: 500,
        message: "Internal server error.",
        code: "INTERNAL_SERVER_ERROR",
        expose: false,
    };
};
const requestContext = (req: Pick<Request, "method" | "originalUrl" | "user">) => ({
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
});
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    const normalized = normalizeError(error);
    const logPayload = {
        ...requestContext(req),
        status: normalized.status,
        code: normalized.code,
        metadata: normalized.metadata,
        error,
    };
    if (normalized.status >= 500) {
        console.error(logPayload);
    }
    else {
        console.warn(logPayload);
    }
    res.status(normalized.status).json(json({
        error: true,
        message: normalized.expose ? normalized.message : "Internal server error.",
        code: normalized.code,
        ...(normalized.metadata ? { metadata: normalized.metadata } : {}),
    }));
};
