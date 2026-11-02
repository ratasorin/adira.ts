import { type Request,type Response } from "express";
import mongoose from "mongoose";
import { type Json,json } from "../../types/json";
export const health = (_req: Request<never, never, {}, {}>, res: Response<Json<{
    status: string;
}>>) => {
    res.json(json({ status: "ok" }));
};
export const readiness = async (_req: Request<never, never, {}, {}>, res: Response<Json<{
    status: string;
}>>) => {
    try {
        if (mongoose.connection.readyState !== 1)
            throw new Error("Database unavailable");
        res.json(json({ status: "ready" }));
    }
    catch {
        res.status(503).json(json({ status: "unavailable" }));
    }
};
export const brandIcon = (_req: Request<never, never, {}, {}>, res: Response<Json<string>>) => {
    res
        .type("svg")
        .send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#737373"/><text x="9" y="29" font-family="sans-serif" font-size="28" font-weight="bold" fill="white">m</text></svg>');
};
